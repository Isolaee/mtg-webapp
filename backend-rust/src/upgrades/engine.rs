// Per-card upgrade engine. Compares each card in a user's deck against the
// format-legal candidate pool (pre-filtered at the SQL layer by color identity)
// and emits Strict / Sidegrade swap suggestions. Tie-breaks by EDHREC inclusion
// when a commander is known. Karsten land advice is bolted on at the report
// level by the route handler.

use std::collections::{HashMap, HashSet};

use regex::Regex;
use serde::Serialize;
use serde_json::Value;

// ── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SwapKind {
    Strict,
    Sidegrade,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Swap {
    pub cut: String,
    pub add: String,
    pub kind: SwapKind,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edhrec_inclusion_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HolisticSummary {
    pub top_strict: Vec<Swap>,
    pub top_sidegrade: Vec<Swap>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpgradeReport {
    pub format: String,
    pub swaps: Vec<Swap>,
    pub holistic: HolisticSummary,
}

/// Engine-internal card shape. Built from the cards table row + tag cache.
/// Numeric magnitudes (damage_n, draw_n, etc.) are pre-extracted so the
/// strict-upgrade predicate can detect "same effect, larger number" pairs
/// like Shock → Lightning Bolt where tags alone are insufficient.
#[derive(Debug, Clone)]
pub struct EngineCard {
    pub name: String,
    pub mana_cost: String,
    pub cmc: u8,
    pub color_identity: Vec<char>,
    pub primary_type: String,
    pub power: Option<i32>,
    pub toughness: Option<i32>,
    pub tags: HashSet<String>,
    pub keyword_tags: HashSet<String>,
    pub magnitudes: HashMap<String, u32>,
    pub is_legal: bool,
}

// ── Parsing helpers ─────────────────────────────────────────────────────────

/// First word of cardtype ("Creature — Dragon" → "creature"). Returns empty
/// for empty input. Lowercased so the predicate can compare directly.
pub fn primary_type(cardtype: &str) -> String {
    cardtype
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_lowercase()
}

/// Parse colored pip counts out of a mana cost. `{2}{W}{W}` → {'W': 2}.
/// Hybrid `{W/U}` counts as 1 toward both colors (matches Karsten's logic).
pub fn pip_counts(mana_cost: &str) -> HashMap<char, u8> {
    let mut counts: HashMap<char, u8> = HashMap::new();
    let mut chars = mana_cost.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '{' {
            continue;
        }
        let mut sym = String::new();
        for sc in chars.by_ref() {
            if sc == '}' {
                break;
            }
            sym.push(sc);
        }
        let up = sym.to_uppercase();
        if up.contains('/') {
            for part in up.split('/') {
                if part.len() == 1 {
                    let ch = part.chars().next().unwrap();
                    if matches!(ch, 'W' | 'U' | 'B' | 'R' | 'G') {
                        *counts.entry(ch).or_insert(0) += 1;
                    }
                }
            }
        } else if up.len() == 1 {
            let ch = up.chars().next().unwrap();
            if matches!(ch, 'W' | 'U' | 'B' | 'R' | 'G') {
                *counts.entry(ch).or_insert(0) += 1;
            }
        }
    }
    counts
}

/// Parse a JSON-string color identity like `["U","B"]` into a list of chars.
pub fn parse_color_identity(json_str: &str) -> Vec<char> {
    let parsed: Vec<String> = serde_json::from_str(json_str).unwrap_or_default();
    parsed
        .into_iter()
        .filter_map(|s| s.chars().next().map(|c| c.to_ascii_uppercase()))
        .filter(|c| matches!(c, 'W' | 'U' | 'B' | 'R' | 'G'))
        .collect()
}

/// Extract numeric effect magnitudes from oracle text. Captures patterns like
/// "deals 3 damage" → ("damage", 3), "draw 2 cards" → ("draw", 2),
/// "gain 4 life" → ("life", 4). When a card has multiple matches we keep
/// the maximum (Bolt is "3 damage", not three "1 damage"s).
pub fn extract_magnitudes(oracle_text: &str) -> HashMap<String, u32> {
    static PATTERNS: std::sync::OnceLock<Vec<(Regex, &'static str)>> = std::sync::OnceLock::new();
    let patterns = PATTERNS.get_or_init(|| {
        vec![
            (Regex::new(r"(?i)deals?\s+(\d+)\s+damage").unwrap(), "damage"),
            (Regex::new(r"(?i)draw\s+(\d+)\s+cards?").unwrap(), "draw"),
            (Regex::new(r"(?i)gains?\s+(\d+)\s+life").unwrap(), "life"),
            (Regex::new(r"(?i)create\s+(\d+)\s+").unwrap(), "tokens"),
            (Regex::new(r"(?i)mills?\s+(\d+)\s+card").unwrap(), "mill"),
            (Regex::new(r"(?i)scry\s+(\d+)").unwrap(), "scry"),
        ]
    });
    let mut out: HashMap<String, u32> = HashMap::new();
    for (re, key) in patterns {
        for cap in re.captures_iter(oracle_text) {
            let Some(num) = cap.get(1).and_then(|m| m.as_str().parse::<u32>().ok()) else {
                continue;
            };
            let entry = out.entry((*key).to_string()).or_insert(0);
            if num > *entry {
                *entry = num;
            }
        }
    }
    out
}

/// Tags that look like Magic keywords (flying, lifelink, etc.) — used for
/// the creature keyword-superset rule.
pub fn split_keyword_tags(tags: &HashSet<String>) -> HashSet<String> {
    static KEYWORDS: &[&str] = &[
        "flying", "trample", "haste", "lifelink", "deathtouch", "vigilance",
        "flash", "menace", "reach", "first_strike", "double_strike", "hexproof",
        "shroud", "indestructible", "ward", "annihilator", "cascade",
        "proliferate", "scry", "surveil", "convoke", "delve", "affinity",
        "cycling", "kicker", "flashback", "madness", "escape", "undying",
        "persist", "dredge", "morbid", "spectacle", "riot", "adapt", "mutate",
        "toxic", "investigate", "evoke", "suspend", "emerge", "transmute",
    ];
    let kw_set: HashSet<&'static str> = KEYWORDS.iter().copied().collect();
    tags.iter()
        .filter(|t| kw_set.contains(t.as_str()))
        .cloned()
        .collect()
}

// ── Predicates ──────────────────────────────────────────────────────────────

fn is_land_type(primary_type: &str) -> bool {
    // Primary type is lowercased by primary_type(). "land" covers "Land —
    // Plains" etc.; "basic" covers "Basic Land — Plains".
    matches!(primary_type, "land" | "basic")
}

fn is_pip_subset(candidate: &HashMap<char, u8>, deck: &HashMap<char, u8>) -> bool {
    for (color, c_count) in candidate {
        let d_count = deck.get(color).copied().unwrap_or(0);
        if *c_count > d_count {
            return false;
        }
    }
    true
}

fn is_color_identity_subset(candidate: &[char], deck: &[char]) -> bool {
    let deck_set: HashSet<char> = deck.iter().copied().collect();
    candidate.iter().all(|c| deck_set.contains(c))
}

fn is_superset(superset: &HashSet<String>, subset: &HashSet<String>) -> bool {
    subset.iter().all(|s| superset.contains(s))
}

fn jaccard(a: &HashSet<String>, b: &HashSet<String>) -> f64 {
    if a.is_empty() && b.is_empty() {
        return 0.0;
    }
    let inter = a.intersection(b).count();
    let union = a.union(b).count();
    if union == 0 {
        0.0
    } else {
        inter as f64 / union as f64
    }
}

/// True if `candidate` is strictly better than `deck_card`: same role, no
/// worse on any measurable axis, strictly better on at least one.
pub fn is_strict_upgrade(deck_card: &EngineCard, candidate: &EngineCard) -> bool {
    if candidate.name == deck_card.name {
        return false;
    }
    if !candidate.is_legal {
        return false;
    }
    // Lands need color-production parity that the spell predicate doesn't
    // model — defer them entirely to the Karsten advisor.
    if is_land_type(&deck_card.primary_type) || is_land_type(&candidate.primary_type) {
        return false;
    }
    // Without any tags on the deck card we have no idea what it does, so
    // we can't safely call anything else "the same effect at lower cost".
    if deck_card.tags.is_empty() {
        return false;
    }
    if candidate.primary_type != deck_card.primary_type {
        return false;
    }
    if candidate.cmc > deck_card.cmc {
        return false;
    }
    if !is_pip_subset(&pip_counts(&candidate.mana_cost), &pip_counts(&deck_card.mana_cost)) {
        return false;
    }
    if !is_color_identity_subset(&candidate.color_identity, &deck_card.color_identity) {
        return false;
    }
    // Tag superset — candidate must do everything the deck card does.
    if !is_superset(&candidate.tags, &deck_card.tags) {
        return false;
    }
    // Numeric magnitudes — candidate must equal or exceed the deck card.
    for (key, &deck_val) in &deck_card.magnitudes {
        let cand_val = candidate.magnitudes.get(key).copied().unwrap_or(0);
        if cand_val < deck_val {
            return false;
        }
    }
    // Creature rules: stats and keywords don't go down.
    if deck_card.primary_type == "creature" {
        if candidate.power.unwrap_or(0) < deck_card.power.unwrap_or(0) {
            return false;
        }
        if candidate.toughness.unwrap_or(0) < deck_card.toughness.unwrap_or(0) {
            return false;
        }
        if !is_superset(&candidate.keyword_tags, &deck_card.keyword_tags) {
            return false;
        }
    }
    // Require at least one strict improvement: lower CMC, larger magnitude,
    // bigger creature, or extra tags/keywords. Otherwise it's just a sidegrade.
    let cmc_improved = candidate.cmc < deck_card.cmc;
    let mag_improved = deck_card.magnitudes.iter().any(|(k, &dv)| {
        candidate.magnitudes.get(k).copied().unwrap_or(0) > dv
    }) || candidate.magnitudes.iter().any(|(k, &cv)| {
        cv > 0 && !deck_card.magnitudes.contains_key(k)
    });
    let creature_improved = deck_card.primary_type == "creature"
        && (candidate.power.unwrap_or(0) > deck_card.power.unwrap_or(0)
            || candidate.toughness.unwrap_or(0) > deck_card.toughness.unwrap_or(0)
            || candidate.keyword_tags.len() > deck_card.keyword_tags.len());
    let tag_improved = candidate.tags.len() > deck_card.tags.len();
    cmc_improved || mag_improved || creature_improved || tag_improved
}

/// True if `candidate` fills the same role at roughly the same cost without
/// being a strict upgrade. Useful for "swap one removal spell for another".
pub fn is_sidegrade(deck_card: &EngineCard, candidate: &EngineCard) -> bool {
    if candidate.name == deck_card.name {
        return false;
    }
    if !candidate.is_legal {
        return false;
    }
    if is_land_type(&deck_card.primary_type) || is_land_type(&candidate.primary_type) {
        return false;
    }
    if deck_card.tags.is_empty() {
        return false;
    }
    if candidate.primary_type != deck_card.primary_type {
        return false;
    }
    let cmc_delta = (candidate.cmc as i32 - deck_card.cmc as i32).abs();
    if cmc_delta > 1 {
        return false;
    }
    if !is_color_identity_subset(&candidate.color_identity, &deck_card.color_identity) {
        return false;
    }
    if jaccard(&candidate.tags, &deck_card.tags) < 0.70 {
        return false;
    }
    // Don't double-report a strict upgrade as a sidegrade.
    !is_strict_upgrade(deck_card, candidate)
}

// ── Reason strings ──────────────────────────────────────────────────────────

fn build_strict_reason(deck_card: &EngineCard, candidate: &EngineCard) -> String {
    let mut parts: Vec<String> = Vec::new();
    if candidate.cmc < deck_card.cmc {
        let delta = deck_card.cmc - candidate.cmc;
        parts.push(format!(
            "{} less mana",
            delta
        ));
    }
    for (key, &dv) in &deck_card.magnitudes {
        let cv = candidate.magnitudes.get(key).copied().unwrap_or(0);
        if cv > dv {
            parts.push(format!("+{} {}", cv - dv, key));
        }
    }
    if deck_card.primary_type == "creature" {
        let dp = deck_card.power.unwrap_or(0);
        let cp = candidate.power.unwrap_or(0);
        let dt = deck_card.toughness.unwrap_or(0);
        let ct = candidate.toughness.unwrap_or(0);
        if cp > dp || ct > dt {
            parts.push(format!("{cp}/{ct} vs {dp}/{dt}"));
        }
        let extra_kw: Vec<String> = candidate
            .keyword_tags
            .difference(&deck_card.keyword_tags)
            .cloned()
            .collect();
        if !extra_kw.is_empty() {
            parts.push(format!("adds {}", extra_kw.join(", ")));
        }
    }
    if parts.is_empty() {
        "strictly better in this role".to_string()
    } else {
        parts.join(", ")
    }
}

fn build_sidegrade_reason(deck_card: &EngineCard, candidate: &EngineCard) -> String {
    let shared: Vec<&String> = deck_card.tags.intersection(&candidate.tags).collect();
    let role = shared
        .iter()
        .find(|t| {
            matches!(
                t.as_str(),
                "counterspell"
                    | "counter_target"
                    | "destroy"
                    | "exile"
                    | "direct_damage"
                    | "draw_cards"
                    | "tutor"
                    | "lifegain"
                    | "token_creation"
                    | "ramp"
                    | "mana_acceleration"
            )
        })
        .map(|s| s.replace('_', " "));
    match role {
        Some(r) => format!("alternative {r}"),
        None => format!("similar {} effect", deck_card.primary_type),
    }
}

// ── Engine ──────────────────────────────────────────────────────────────────

/// Build an EngineCard from a raw JSON row (as returned by db::analysis or the
/// new candidate loader) plus the cached tag list for that card.
pub fn build_engine_card(row: &Value, tags: &[String], is_legal: bool) -> EngineCard {
    let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let mana_cost = row.get("manacost").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let cmc = row.get("cmc").and_then(|v| v.as_f64()).unwrap_or(0.0) as u8;
    let color_identity = row
        .get("coloridentity")
        .and_then(|v| v.as_str())
        .map(parse_color_identity)
        .unwrap_or_default();
    let primary_type = primary_type(row.get("cardtype").and_then(|v| v.as_str()).unwrap_or(""));
    let power = row
        .get("power")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<i32>().ok());
    let toughness = row
        .get("toughness")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<i32>().ok());
    let oracle_text = row.get("oracletext").and_then(|v| v.as_str()).unwrap_or("");
    let magnitudes = extract_magnitudes(oracle_text);
    // Filter out structural `key:value` tags (cmc:3-4, color:U, type:instant,
    // subtype:dragon, ci:U). Those duplicate fields we already compare via
    // dedicated predicate steps; including them would make the tag-superset
    // check fail any time CMC differs — i.e. exactly when we want it to pass.
    let tag_set: HashSet<String> = tags
        .iter()
        .filter(|t| !t.contains(':'))
        .cloned()
        .collect();
    let keyword_tags = split_keyword_tags(&tag_set);

    EngineCard {
        name,
        mana_cost,
        cmc,
        color_identity,
        primary_type,
        power,
        toughness,
        tags: tag_set,
        keyword_tags,
        magnitudes,
        is_legal,
    }
}

/// The pure heart of the engine — score all (deck_card, candidate) pairs and
/// return swap suggestions. Up to `per_card_limit` swaps of each kind are
/// retained per deck card to keep the output digestible. `edhrec` is used
/// for the global tie-break (higher inclusion → higher confidence).
pub fn build_report(
    deck_cards: &[EngineCard],
    candidates: &[EngineCard],
    edhrec: &HashMap<String, f64>,
    per_card_limit: usize,
    format: &str,
) -> UpgradeReport {
    let mut all_swaps: Vec<Swap> = Vec::new();
    // Dedup by deck-card name — even if a player has 4 copies, only suggest once.
    let mut seen: HashSet<String> = HashSet::new();

    for deck_card in deck_cards {
        if !seen.insert(deck_card.name.clone()) {
            continue;
        }
        let mut strict_for_card: Vec<Swap> = Vec::new();
        let mut sidegrade_for_card: Vec<Swap> = Vec::new();
        for candidate in candidates {
            if is_strict_upgrade(deck_card, candidate) {
                strict_for_card.push(Swap {
                    cut: deck_card.name.clone(),
                    add: candidate.name.clone(),
                    kind: SwapKind::Strict,
                    reason: build_strict_reason(deck_card, candidate),
                    edhrec_inclusion_pct: edhrec.get(&candidate.name).copied(),
                });
            } else if is_sidegrade(deck_card, candidate) {
                sidegrade_for_card.push(Swap {
                    cut: deck_card.name.clone(),
                    add: candidate.name.clone(),
                    kind: SwapKind::Sidegrade,
                    reason: build_sidegrade_reason(deck_card, candidate),
                    edhrec_inclusion_pct: edhrec.get(&candidate.name).copied(),
                });
            }
        }
        sort_by_inclusion(&mut strict_for_card);
        sort_by_inclusion(&mut sidegrade_for_card);
        strict_for_card.truncate(per_card_limit);
        sidegrade_for_card.truncate(per_card_limit);
        all_swaps.extend(strict_for_card);
        all_swaps.extend(sidegrade_for_card);
    }

    let mut top_strict: Vec<Swap> = all_swaps
        .iter()
        .filter(|s| s.kind == SwapKind::Strict)
        .cloned()
        .collect();
    sort_by_inclusion(&mut top_strict);
    top_strict.truncate(10);

    let mut top_sidegrade: Vec<Swap> = all_swaps
        .iter()
        .filter(|s| s.kind == SwapKind::Sidegrade)
        .cloned()
        .collect();
    sort_by_inclusion(&mut top_sidegrade);
    top_sidegrade.truncate(5);

    UpgradeReport {
        format: format.to_string(),
        swaps: all_swaps,
        holistic: HolisticSummary { top_strict, top_sidegrade },
    }
}

fn sort_by_inclusion(swaps: &mut [Swap]) {
    swaps.sort_by(|a, b| {
        // EDHREC inclusion first (higher = better).
        let a_inc = a.edhrec_inclusion_pct.unwrap_or(0.0);
        let b_inc = b.edhrec_inclusion_pct.unwrap_or(0.0);
        match b_inc.partial_cmp(&a_inc).unwrap_or(std::cmp::Ordering::Equal) {
            std::cmp::Ordering::Equal => {
                // Tiebreak: swaps whose reason starts with an explicit "N less
                // mana" or "+N damage/draw/..." rank above generic "strictly
                // better in this role" so canonical examples like
                // Cancel → Counterspell don't get crowded out by clones.
                let a_explicit = explicit_improvement_rank(&a.reason);
                let b_explicit = explicit_improvement_rank(&b.reason);
                b_explicit.cmp(&a_explicit)
            }
            other => other,
        }
    });
}

fn explicit_improvement_rank(reason: &str) -> u32 {
    if reason.contains(" less mana") || reason.starts_with('+') {
        1
    } else {
        0
    }
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn card(
        name: &str,
        mana_cost: &str,
        cmc: u8,
        primary_type: &str,
        oracle: &str,
        tags: &[&str],
    ) -> EngineCard {
        let tag_set: HashSet<String> = tags.iter().map(|s| s.to_string()).collect();
        EngineCard {
            name: name.to_string(),
            mana_cost: mana_cost.to_string(),
            cmc,
            color_identity: pip_counts(mana_cost).keys().copied().collect(),
            primary_type: primary_type.to_string(),
            power: None,
            toughness: None,
            keyword_tags: split_keyword_tags(&tag_set),
            tags: tag_set,
            magnitudes: extract_magnitudes(oracle),
            is_legal: true,
        }
    }

    fn creature(
        name: &str,
        mana_cost: &str,
        cmc: u8,
        power: i32,
        toughness: i32,
        tags: &[&str],
    ) -> EngineCard {
        let mut c = card(name, mana_cost, cmc, "creature", "", tags);
        c.power = Some(power);
        c.toughness = Some(toughness);
        c
    }

    #[test]
    fn counterspell_is_strict_upgrade_of_cancel() {
        let cancel = card("Cancel", "{1}{U}{U}", 3, "instant", "Counter target spell.", &["counterspell"]);
        let counterspell = card("Counterspell", "{U}{U}", 2, "instant", "Counter target spell.", &["counterspell"]);
        assert!(is_strict_upgrade(&cancel, &counterspell));
        assert!(!is_strict_upgrade(&counterspell, &cancel));
    }

    #[test]
    fn lightning_bolt_is_strict_upgrade_of_shock() {
        let shock = card("Shock", "{R}", 1, "instant", "Shock deals 2 damage to any target.", &["direct_damage"]);
        let bolt = card("Lightning Bolt", "{R}", 1, "instant", "Lightning Bolt deals 3 damage to any target.", &["direct_damage"]);
        assert!(is_strict_upgrade(&shock, &bolt));
        assert!(!is_strict_upgrade(&bolt, &shock));
    }

    #[test]
    fn counterspell_is_not_strict_upgrade_of_bolt() {
        let bolt = card("Lightning Bolt", "{R}", 1, "instant", "Lightning Bolt deals 3 damage.", &["direct_damage"]);
        let counterspell = card("Counterspell", "{U}{U}", 2, "instant", "Counter target spell.", &["counterspell"]);
        assert!(!is_strict_upgrade(&bolt, &counterspell));
    }

    #[test]
    fn same_card_is_not_strict_upgrade_of_itself() {
        let bolt = card("Lightning Bolt", "{R}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        assert!(!is_strict_upgrade(&bolt, &bolt));
    }

    #[test]
    fn off_color_is_not_strict_upgrade() {
        // Equal-cost instant in a different color is not a swap candidate at all.
        let bolt = card("Lightning Bolt", "{R}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        let mut white_bolt = card("White Bolt", "{W}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        white_bolt.color_identity = vec!['W'];
        assert!(!is_strict_upgrade(&bolt, &white_bolt));
    }

    #[test]
    fn illegal_candidate_rejected() {
        let cancel = card("Cancel", "{1}{U}{U}", 3, "instant", "Counter target spell.", &["counterspell"]);
        let mut counterspell = card("Counterspell", "{U}{U}", 2, "instant", "Counter target spell.", &["counterspell"]);
        counterspell.is_legal = false;
        assert!(!is_strict_upgrade(&cancel, &counterspell));
    }

    #[test]
    fn extra_tags_count_as_improvement() {
        // Same CMC, same cost — but candidate has an extra tag (e.g., "draw_cards").
        let plain = card("Plain Spell", "{2}{U}", 3, "instant", "Counter target spell.", &["counterspell"]);
        let bonus = card("Bonus Spell", "{2}{U}", 3, "instant", "Counter target spell. Draw a card.", &["counterspell", "draw_cards"]);
        assert!(is_strict_upgrade(&plain, &bonus));
    }

    #[test]
    fn identical_cards_with_different_names_are_not_strict_upgrades() {
        // Functional reprint — same CMC, same tags, same magnitudes, just a different name.
        let a = card("Card A", "{R}", 1, "instant", "Deals 3 damage to any target.", &["direct_damage"]);
        let mut b = card("Card B", "{R}", 1, "instant", "Deals 3 damage to any target.", &["direct_damage"]);
        b.color_identity = a.color_identity.clone();
        assert!(!is_strict_upgrade(&a, &b), "functional reprints aren't strict upgrades");
    }

    #[test]
    fn creature_strict_upgrade_requires_better_stats() {
        let bear = creature("Grizzly Bears", "{1}{G}", 2, 2, 2, &["beater"]);
        let watchwolf = creature("Watchwolf", "{G}{W}", 2, 3, 3, &["beater"]);
        // Watchwolf has tougher stats but different color cost — color identity
        // {GW} is not a subset of {G}.
        assert!(!is_strict_upgrade(&bear, &watchwolf));
        // Same color, bigger stats → strict upgrade.
        let stompy = creature("Stompy Bears", "{1}{G}", 2, 3, 3, &["beater"]);
        assert!(is_strict_upgrade(&bear, &stompy));
    }

    #[test]
    fn creature_strict_upgrade_keyword_superset() {
        let plain_bear = creature("Plain Bear", "{1}{G}", 2, 2, 2, &["beater"]);
        let trample_bear = creature("Trample Bear", "{1}{G}", 2, 2, 2, &["beater", "trample"]);
        // Same stats but candidate adds trample → strict upgrade.
        assert!(is_strict_upgrade(&plain_bear, &trample_bear));
        // Reverse: removing trample → not an upgrade.
        assert!(!is_strict_upgrade(&trample_bear, &plain_bear));
    }

    #[test]
    fn lands_are_skipped_in_strict_upgrade() {
        let swamp = card("Swamp", "", 0, "land", "{T}: Add {B}.", &[]);
        let radiant = card("Radiant Fountain", "", 0, "land", "{T}: Add {C}.", &["lifegain"]);
        assert!(!is_strict_upgrade(&swamp, &radiant));
    }

    #[test]
    fn untagged_deck_card_never_gets_strict_upgrade() {
        // Without tags we have no idea what the card does, so don't suggest swaps.
        let mystery = card("Mystery Spell", "{2}{U}", 3, "instant", "Do something.", &[]);
        let cheaper = card("Cheap Spell", "{U}", 1, "instant", "Counter target spell.", &["counterspell"]);
        assert!(!is_strict_upgrade(&mystery, &cheaper));
    }

    #[test]
    fn sidegrade_finds_similar_removal() {
        // Two black removal spells: same type, same CMC, overlapping tags.
        let doom_blade = card("Doom Blade", "{1}{B}", 2, "instant", "Destroy target nonblack creature.", &["destroy"]);
        let go_for_throat = card("Go for the Throat", "{1}{B}", 2, "instant", "Destroy target nonartifact creature.", &["destroy"]);
        assert!(is_sidegrade(&doom_blade, &go_for_throat));
    }

    #[test]
    fn sidegrade_rejects_strict_upgrade() {
        let cancel = card("Cancel", "{1}{U}{U}", 3, "instant", "Counter target spell.", &["counterspell"]);
        let counterspell = card("Counterspell", "{U}{U}", 2, "instant", "Counter target spell.", &["counterspell"]);
        // Counterspell is a strict upgrade — so it should NOT show up as a sidegrade too.
        assert!(!is_sidegrade(&cancel, &counterspell));
    }

    #[test]
    fn sidegrade_rejects_cmc_gap() {
        let bolt = card("Lightning Bolt", "{R}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        let big_burn = card("Big Burn", "{4}{R}", 5, "instant", "Deals 8 damage.", &["direct_damage"]);
        // CMC delta = 4 → too far apart.
        assert!(!is_sidegrade(&bolt, &big_burn));
    }

    #[test]
    fn sidegrade_requires_color_identity_subset() {
        let bolt = card("Lightning Bolt", "{R}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        let mut white_burn = card("White Burn", "{W}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        white_burn.color_identity = vec!['W'];
        // White Burn requires W; mono-red deck (CI = {R}) can't include it.
        assert!(!is_sidegrade(&bolt, &white_burn));
    }

    #[test]
    fn pip_counting() {
        let p = pip_counts("{2}{W}{W}");
        assert_eq!(p.get(&'W').copied(), Some(2));
        let h = pip_counts("{W/U}{W/U}");
        assert_eq!(h.get(&'W').copied(), Some(2));
        assert_eq!(h.get(&'U').copied(), Some(2));
    }

    #[test]
    fn magnitudes_take_max() {
        let m = extract_magnitudes("Deals 3 damage. Deals 5 damage.");
        assert_eq!(m.get("damage"), Some(&5));
    }

    #[test]
    fn primary_type_extraction() {
        assert_eq!(primary_type("Creature — Dragon"), "creature");
        assert_eq!(primary_type("Legendary Creature — Dragon"), "legendary");
        assert_eq!(primary_type(""), "");
    }

    #[test]
    fn report_dedups_by_deck_card_name() {
        let shock = card("Shock", "{R}", 1, "instant", "Deals 2 damage.", &["direct_damage"]);
        let bolt = card("Lightning Bolt", "{R}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        let deck = vec![shock.clone(), shock.clone(), shock]; // 3 copies
        let candidates = vec![bolt];
        let report = build_report(&deck, &candidates, &HashMap::new(), 5, "modern");
        // Should produce a single Shock→Bolt swap, not three.
        let strict: Vec<_> = report.swaps.iter().filter(|s| s.kind == SwapKind::Strict).collect();
        assert_eq!(strict.len(), 1);
        assert_eq!(strict[0].cut, "Shock");
        assert_eq!(strict[0].add, "Lightning Bolt");
    }

    #[test]
    fn report_sorts_by_edhrec_inclusion() {
        let shock = card("Shock", "{R}", 1, "instant", "Deals 2 damage.", &["direct_damage"]);
        let bolt = card("Lightning Bolt", "{R}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        let chain = card("Chain Lightning", "{R}", 1, "instant", "Deals 3 damage.", &["direct_damage"]);
        let mut edhrec = HashMap::new();
        edhrec.insert("Lightning Bolt".to_string(), 50.0);
        edhrec.insert("Chain Lightning".to_string(), 80.0);
        let report = build_report(&[shock], &[bolt, chain], &edhrec, 5, "modern");
        // Chain Lightning (80%) should be ranked above Lightning Bolt (50%).
        let strict: Vec<_> = report.swaps.iter().filter(|s| s.kind == SwapKind::Strict).collect();
        assert_eq!(strict[0].add, "Chain Lightning");
        assert_eq!(strict[1].add, "Lightning Bolt");
    }
}
