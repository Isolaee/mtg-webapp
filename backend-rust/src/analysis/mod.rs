use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use regex::Regex;
use serde_json::Value;

#[derive(Debug, Default, Clone)]
pub struct DeckProfile {
    /// card name/id → quantity (deduplicated)
    pub card_counts: HashMap<String, u32>,
    /// 'W'/'U'/'B'/'R'/'G' → count of cards of that color
    pub color_counts: HashMap<char, u32>,
    /// CMC buckets: [0, 1, 2, 3, 4, 5, 6, 7, 8+]
    pub cmc_histogram: [u32; 9],
    /// semantic tag → weighted frequency sum across deck
    pub semantic_vector: HashMap<String, f32>,
}

#[derive(Debug, Clone)]
pub struct ClassicScores {
    pub jaccard: f64,
    pub cosine: f64,
    pub color_profile: f64,
    pub cmc_curve: f64,
    pub combined: f64,
}

#[derive(Debug, Clone)]
pub struct ComparisonResult {
    pub classic: ClassicScores,
    pub semantic_cosine: f64,
    pub overall: f64,
    pub shared_cards: Vec<String>,
    pub unique_to_a: Vec<String>,
    pub unique_to_b: Vec<String>,
}

// Weights for classic combined score
const W_JACCARD: f64 = 0.25;
const W_COSINE: f64 = 0.35;
const W_COLOR: f64 = 0.15;
const W_CMC: f64 = 0.25;

// Blend of classic vs semantic for overall
const W_CLASSIC: f64 = 0.6;
const W_SEMANTIC: f64 = 0.4;

// ── Tag extraction ──────────────────────────────────────────────────────────

fn keyword_list() -> &'static [&'static str] {
    static KEYWORDS: OnceLock<Vec<&'static str>> = OnceLock::new();
    KEYWORDS.get_or_init(|| {
        vec![
            "flying",
            "trample",
            "haste",
            "lifelink",
            "deathtouch",
            "vigilance",
            "flash",
            "menace",
            "reach",
            "first strike",
            "double strike",
            "hexproof",
            "shroud",
            "indestructible",
            "protection",
            "ward",
            "annihilator",
            "cascade",
            "proliferate",
            "scry",
            "surveil",
            "convoke",
            "delve",
            "affinity",
            "cycling",
            "kicker",
            "morph",
            "transform",
            "flashback",
            "madness",
            "escape",
            "undying",
            "persist",
            "dredge",
            "storm",
            "threshold",
            "morbid",
            "spectacle",
            "riot",
            "adapt",
            "mutate",
            "toxic",
            "investigate",
            "partner",
            "exploit",
            "evoke",
            "suspend",
            "emerge",
            "transmute",
        ]
    })
}

fn regex_patterns() -> &'static Vec<(Regex, &'static str)> {
    static PATTERNS: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        let raw: &[(&str, &str)] = &[
            (r"(?i)draw(?:s)?\s+(?:a|\d+)\s+card", "draw_cards"),
            (r"(?i)deal(?:s)?\s+\d+\s+damage", "direct_damage"),
            (r"(?i)deal(?:s)?\s+.{0,15}damage", "deals_damage"),
            (r"(?i)destroy\s+(?:target|all|each)", "destroy"),
            (r"(?i)exile\s+(?:target|all|each|it)", "exile"),
            (r"(?i)counter\s+target\s+spell", "counterspell"),
            (r"(?i)counter\s+target", "counter_target"),
            (r"(?i)gain\s+\d+\s+life", "lifegain"),
            (r"(?i)create\s+(?:a|\d+)\s+.{0,30}token", "token_creation"),
            (r"(?i)search\s+your\s+library", "tutor"),
            (r"(?i)discard\s+(?:a|your\s+hand|\d+)", "discard"),
            (
                r"(?i)from\s+(?:a\s+|your\s+)?graveyard",
                "graveyard_synergy",
            ),
            (r"(?i)enters\s+the\s+battlefield", "etb_trigger"),
            (r"(?i)whenever\s+.{0,40}\s+attacks", "attack_trigger"),
            (r"(?i)whenever\s+.{0,40}\s+dies?", "death_trigger"),
            (r"(?i)\+1/\+1\s+counter", "plus_counters"),
            (r"(?i)add\s+\{[WUBRGC]\}", "mana_acceleration"),
            (r"(?i)copy\s+(?:target|it|this)", "copy_effect"),
            (r"(?i)sacrifice\s+(?:a|another|target)", "sacrifice_outlet"),
            (
                r"(?i)put\s+.{0,30}\s+onto\s+the\s+battlefield",
                "cheat_into_play",
            ),
            (r"(?i)each\s+opponent", "multiplayer_effect"),
        ];
        raw.iter()
            .map(|(pat, tag)| (Regex::new(pat).expect("bad regex"), *tag))
            .collect()
    })
}

/// Extract semantic tags from a card's oracle/description text.
fn extract_text_tags(text: &str, out: &mut Vec<String>) {
    let lower = text.to_lowercase();
    for kw in keyword_list() {
        if lower.contains(kw) {
            out.push(kw.replace(' ', "_"));
        }
    }
    for (re, tag) in regex_patterns() {
        if re.is_match(text) {
            out.push(tag.to_string());
        }
    }
}

/// Build semantic tags for a card from all its fields.
/// `game` is "mtg" or "riftbound".
pub fn extract_tags_for_card(card: &Value, game: &str) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();

    if game == "riftbound" {
        // Structured fields
        if let Some(faction) = card.get("faction").and_then(|v| v.as_str()) {
            tags.push(format!("faction:{}", faction.to_lowercase()));
        }
        if let Some(ct) = card.get("card_type").and_then(|v| v.as_str()) {
            tags.push(format!("type:{}", ct.to_lowercase()));
        }
        // Stat buckets
        for stat in ["energy", "might", "power"] {
            if let Some(val) = card.get(stat).and_then(|v| v.as_i64()) {
                let bucket = if val <= 1 {
                    "low"
                } else if val <= 3 {
                    "mid"
                } else {
                    "high"
                };
                tags.push(format!("{}:{}", stat, bucket));
            }
        }
        // keywords JSON array
        if let Some(kw_str) = card.get("keywords").and_then(|v| v.as_str()) {
            if let Ok(kws) = serde_json::from_str::<Vec<String>>(kw_str) {
                for kw in kws {
                    tags.push(format!("kw:{}", kw.to_lowercase().replace(' ', "_")));
                }
            }
        }
        // tags JSON array
        if let Some(tag_str) = card.get("tags").and_then(|v| v.as_str()) {
            if let Ok(rb_tags) = serde_json::from_str::<Vec<String>>(tag_str) {
                for t in rb_tags {
                    tags.push(format!("tag:{}", t.to_lowercase().replace(' ', "_")));
                }
            }
        }
        // Text
        if let Some(desc) = card.get("description").and_then(|v| v.as_str()) {
            extract_text_tags(desc, &mut tags);
        }
    } else {
        // MTG
        // Colors
        let colors_str = card
            .get("colors")
            .or_else(|| card.get("coloridentity").or_else(|| card.get("colorIdentity")))
            .and_then(|v| v.as_str())
            .unwrap_or("[]");
        if let Ok(colors) = serde_json::from_str::<Vec<String>>(colors_str) {
            for c in &colors {
                tags.push(format!("color:{}", c.to_uppercase()));
            }
        }
        // Color identity (prefix ci:)
        let ci_str = card
            .get("coloridentity")
            .or_else(|| card.get("colorIdentity"))
            .and_then(|v| v.as_str())
            .unwrap_or("[]");
        if let Ok(ci) = serde_json::from_str::<Vec<String>>(ci_str) {
            for c in ci {
                tags.push(format!("ci:{}", c.to_uppercase()));
            }
        }
        // Card types
        let cardtype = card
            .get("cardtype")
            .or_else(|| card.get("cardType"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        for part in cardtype.split_whitespace() {
            let lower = part.to_lowercase();
            match lower.as_str() {
                "creature" | "instant" | "sorcery" | "artifact" | "enchantment"
                | "planeswalker" | "land" | "battle" | "tribal" => {
                    tags.push(format!("type:{}", lower));
                }
                _ => {}
            }
        }
        // Subtypes from typeline (after "—")
        let typeline = card.get("typeline").and_then(|v| v.as_str()).unwrap_or("");
        if let Some(sub_part) = typeline.split('—').nth(1) {
            for sub in sub_part.split_whitespace() {
                let s = sub.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
                if !s.is_empty() {
                    tags.push(format!("subtype:{}", s));
                }
            }
        }
        // CMC bucket
        let cmc = card.get("cmc").and_then(|v| v.as_f64()).unwrap_or(-1.0);
        let is_land = cardtype.to_lowercase().contains("land");
        if cmc >= 0.0 && !is_land {
            let bucket = match cmc as u32 {
                0 => "0",
                1..=2 => "1-2",
                3..=4 => "3-4",
                5..=6 => "5-6",
                _ => "7+",
            };
            tags.push(format!("cmc:{}", bucket));
        }
        // Oracle text
        let oracle = card
            .get("oracletext")
            .or_else(|| card.get("oracleText"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        extract_text_tags(oracle, &mut tags);
    }

    // Deduplicate
    tags.sort_unstable();
    tags.dedup();
    tags
}

// ── DeckProfile builders ────────────────────────────────────────────────────

/// Build a DeckProfile from the flat JSON card array stored in the MTG user `decks` table.
/// Cards are stored with duplicates (one object per copy); iterate and count.
pub fn build_profile_from_flat_cards(
    cards: &[Value],
    tag_cache: &HashMap<String, Vec<String>>,
) -> DeckProfile {
    let mut profile = DeckProfile::default();
    for card in cards {
        let name = card
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        *profile.card_counts.entry(name.clone()).or_insert(0) += 1;
        let qty = profile.card_counts[&name];

        // Only update color/cmc/semantic on first occurrence of each name
        // (they're the same card, just duplicated for quantity tracking)
        if qty == 1 {
            add_mtg_card_to_profile(card, 1, &name, tag_cache, &mut profile);
        } else {
            // Add extra quantity to semantic vector only
            if let Some(tags) = tag_cache.get(&name) {
                for tag in tags {
                    *profile.semantic_vector.entry(tag.clone()).or_insert(0.0) += 1.0;
                }
            }
        }
    }
    profile
}

fn add_mtg_card_to_profile(
    card: &Value,
    qty: u32,
    name: &str,
    tag_cache: &HashMap<String, Vec<String>>,
    profile: &mut DeckProfile,
) {
    // Colors
    let colors_str = card
        .get("colors")
        .and_then(|v| v.as_str())
        .unwrap_or("[]");
    if let Ok(colors) = serde_json::from_str::<Vec<String>>(colors_str) {
        for c in colors {
            if let Some(ch) = c.chars().next() {
                *profile.color_counts.entry(ch).or_insert(0) += qty;
            }
        }
    }
    // CMC histogram
    let cardtype = card
        .get("cardtype")
        .or_else(|| card.get("cardType"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let is_land = cardtype.to_lowercase().contains("land");
    if let Some(cmc) = card.get("cmc").and_then(|v| v.as_f64()) {
        if !is_land {
            let bucket = (cmc as usize).min(8);
            profile.cmc_histogram[bucket] += qty;
        }
    }
    // Semantic tags
    if let Some(tags) = tag_cache.get(name) {
        for tag in tags {
            *profile.semantic_vector.entry(tag.clone()).or_insert(0.0) += qty as f32;
        }
    }
}

/// Entry structure for tournament decklists and Riftbound deck entries.
#[derive(Debug, Clone)]
pub struct DeckEntry {
    pub name: String,
    pub qty: u32,
    pub card_type: String, // "main", "sideboard", "deck_url", etc.
}

/// Build profile from MTGO tournament decklist (name+qty, card details fetched separately).
/// Only "main" entries are included.
pub fn build_profile_from_decklist(
    decklist: &[DeckEntry],
    card_details: &HashMap<String, Value>,
    tag_cache: &HashMap<String, Vec<String>>,
) -> DeckProfile {
    let mut profile = DeckProfile::default();
    for entry in decklist {
        if entry.card_type != "main" {
            continue;
        }
        let name = &entry.name;
        *profile.card_counts.entry(name.clone()).or_insert(0) += entry.qty;
        if let Some(card) = card_details.get(name) {
            add_mtg_card_to_profile(card, entry.qty, name, tag_cache, &mut profile);
        } else {
            // Card not found in DB — still add to semantic via cache
            if let Some(tags) = tag_cache.get(name) {
                for tag in tags {
                    *profile.semantic_vector.entry(tag.clone()).or_insert(0.0) +=
                        entry.qty as f32;
                }
            }
        }
    }
    profile
}

/// Build profile from a Riftbound user deck (rb_cards loaded by ID).
pub fn build_profile_from_rb_deck(
    entries: &[DeckEntry], // {name: card_id, qty, card_type: "main"|"rune"}
    card_details: &HashMap<String, Value>, // id → rb_card JSON
    tag_cache: &HashMap<String, Vec<String>>, // id → tags
) -> DeckProfile {
    let mut profile = DeckProfile::default();
    for entry in entries {
        let id = &entry.name; // rb deck entries use card ID as name
        *profile.card_counts.entry(id.clone()).or_insert(0) += entry.qty;
        // Faction → color_counts (using faction initial as char key for reuse)
        if let Some(card) = card_details.get(id) {
            if let Some(faction) = card.get("faction").and_then(|v| v.as_str()) {
                // Map faction to a char for the color_counts histogram
                let ch = faction.chars().next().unwrap_or('?');
                *profile.color_counts.entry(ch).or_insert(0) += entry.qty;
            }
            // Stats → cmc_histogram (use energy as primary CMC analogue)
            if let Some(energy) = card.get("energy").and_then(|v| v.as_i64()) {
                let bucket = (energy as usize).min(8);
                profile.cmc_histogram[bucket] += entry.qty;
            }
        }
        // Semantic tags
        if let Some(tags) = tag_cache.get(id) {
            for tag in tags {
                *profile.semantic_vector.entry(tag.clone()).or_insert(0.0) += entry.qty as f32;
            }
        }
    }
    profile
}

// ── Similarity computation ──────────────────────────────────────────────────

pub fn compare(a: &DeckProfile, b: &DeckProfile) -> ComparisonResult {
    let jaccard = jaccard_similarity(&a.card_counts, &b.card_counts);
    let cosine = cosine_count_maps(&a.card_counts, &b.card_counts);
    let color_profile = cosine_char_maps(&a.color_counts, &b.color_counts);
    let cmc_curve = cosine_u32_arrays(&a.cmc_histogram, &b.cmc_histogram);
    let combined = W_JACCARD * jaccard + W_COSINE * cosine + W_COLOR * color_profile + W_CMC * cmc_curve;

    let semantic_cosine = cosine_f32_maps(&a.semantic_vector, &b.semantic_vector);
    let overall = W_CLASSIC * combined + W_SEMANTIC * semantic_cosine;

    let a_set: HashSet<&String> = a.card_counts.keys().collect();
    let b_set: HashSet<&String> = b.card_counts.keys().collect();
    let mut shared_cards: Vec<String> = a_set.intersection(&b_set).map(|s| (*s).clone()).collect();
    let mut unique_to_a: Vec<String> = a_set.difference(&b_set).map(|s| (*s).clone()).collect();
    let mut unique_to_b: Vec<String> = b_set.difference(&a_set).map(|s| (*s).clone()).collect();
    shared_cards.sort_unstable();
    unique_to_a.sort_unstable();
    unique_to_b.sort_unstable();

    ComparisonResult {
        classic: ClassicScores { jaccard, cosine, color_profile, cmc_curve, combined },
        semantic_cosine,
        overall,
        shared_cards,
        unique_to_a,
        unique_to_b,
    }
}

fn jaccard_similarity(a: &HashMap<String, u32>, b: &HashMap<String, u32>) -> f64 {
    let a_set: HashSet<&String> = a.keys().collect();
    let b_set: HashSet<&String> = b.keys().collect();
    let inter = a_set.intersection(&b_set).count();
    let union = a_set.union(&b_set).count();
    if union == 0 { 0.0 } else { inter as f64 / union as f64 }
}

fn cosine_count_maps(a: &HashMap<String, u32>, b: &HashMap<String, u32>) -> f64 {
    let mut dot = 0u64;
    let mut mag_a = 0u64;
    let mut mag_b = 0u64;
    for (k, va) in a {
        mag_a += (*va as u64) * (*va as u64);
        if let Some(vb) = b.get(k) {
            dot += (*va as u64) * (*vb as u64);
        }
    }
    for vb in b.values() {
        mag_b += (*vb as u64) * (*vb as u64);
    }
    let denom = (mag_a as f64).sqrt() * (mag_b as f64).sqrt();
    if denom == 0.0 { 0.0 } else { dot as f64 / denom }
}

fn cosine_char_maps(a: &HashMap<char, u32>, b: &HashMap<char, u32>) -> f64 {
    let mut dot = 0u64;
    let mut mag_a = 0u64;
    let mut mag_b = 0u64;
    for (k, va) in a {
        mag_a += (*va as u64) * (*va as u64);
        if let Some(vb) = b.get(k) {
            dot += (*va as u64) * (*vb as u64);
        }
    }
    for vb in b.values() {
        mag_b += (*vb as u64) * (*vb as u64);
    }
    let denom = (mag_a as f64).sqrt() * (mag_b as f64).sqrt();
    if denom == 0.0 { 0.0 } else { dot as f64 / denom }
}

fn cosine_f32_maps(a: &HashMap<String, f32>, b: &HashMap<String, f32>) -> f64 {
    let mut dot = 0f64;
    let mut mag_a = 0f64;
    let mut mag_b = 0f64;
    for (k, va) in a {
        mag_a += (*va as f64) * (*va as f64);
        if let Some(vb) = b.get(k) {
            dot += (*va as f64) * (*vb as f64);
        }
    }
    for vb in b.values() {
        mag_b += (*vb as f64) * (*vb as f64);
    }
    let denom = mag_a.sqrt() * mag_b.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}

fn cosine_u32_arrays(a: &[u32; 9], b: &[u32; 9]) -> f64 {
    let dot: u64 = a.iter().zip(b.iter()).map(|(x, y)| (*x as u64) * (*y as u64)).sum();
    let mag_a: u64 = a.iter().map(|x| (*x as u64) * (*x as u64)).sum();
    let mag_b: u64 = b.iter().map(|x| (*x as u64) * (*x as u64)).sum();
    let denom = (mag_a as f64).sqrt() * (mag_b as f64).sqrt();
    if denom == 0.0 { 0.0 } else { dot as f64 / denom }
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_text_tags_keywords() {
        let mut tags = Vec::new();
        extract_text_tags("Flying. Lifelink.", &mut tags);
        assert!(tags.contains(&"flying".to_string()), "expected flying");
        assert!(tags.contains(&"lifelink".to_string()), "expected lifelink");
    }

    #[test]
    fn test_extract_text_tags_regex() {
        let mut tags = Vec::new();
        extract_text_tags("Deal 3 damage to any target.", &mut tags);
        assert!(tags.contains(&"direct_damage".to_string()), "expected direct_damage");
        assert!(tags.contains(&"deals_damage".to_string()), "expected deals_damage");
    }

    #[test]
    fn test_extract_tags_mtg_structured() {
        let card = json!({
            "name": "Test Dragon",
            "colors": "[\"R\"]",
            "cardtype": "Creature",
            "typeline": "Creature — Dragon",
            "cmc": 5.0,
            "oracletext": "Flying. When this enters the battlefield, deal 3 damage."
        });
        let tags = extract_tags_for_card(&card, "mtg");
        assert!(tags.contains(&"color:R".to_string()), "expected color:R");
        assert!(tags.contains(&"type:creature".to_string()), "expected type:creature");
        assert!(tags.contains(&"subtype:dragon".to_string()), "expected subtype:dragon");
        assert!(tags.contains(&"cmc:5-6".to_string()), "expected cmc:5-6");
        assert!(tags.contains(&"flying".to_string()), "expected flying keyword");
        assert!(tags.contains(&"etb_trigger".to_string()), "expected etb_trigger");
    }

    #[test]
    fn test_extract_tags_riftbound_structured() {
        let card = json!({
            "faction": "fury",
            "card_type": "Unit",
            "energy": 2,
            "might": 3,
            "power": 1,
            "keywords": "[\"Flying\",\"Lifesteal\"]",
            "tags": "[\"removal\"]",
            "description": "Deal 3 damage to any target."
        });
        let tags = extract_tags_for_card(&card, "riftbound");
        assert!(tags.contains(&"faction:fury".to_string()));
        assert!(tags.contains(&"type:unit".to_string()));
        assert!(tags.contains(&"energy:mid".to_string()));
        assert!(tags.contains(&"kw:flying".to_string()));
        assert!(tags.contains(&"tag:removal".to_string()));
        assert!(tags.contains(&"direct_damage".to_string()));
    }

    #[test]
    fn test_compare_identical_profiles() {
        let mut cache = HashMap::new();
        cache.insert("Lightning Bolt".to_string(), vec!["direct_damage".to_string(), "type:instant".to_string()]);
        let cards = vec![
            json!({"name": "Lightning Bolt", "colors": "[\"R\"]", "cardtype": "Instant", "typeline": "Instant", "cmc": 1.0}),
            json!({"name": "Lightning Bolt", "colors": "[\"R\"]", "cardtype": "Instant", "typeline": "Instant", "cmc": 1.0}),
            json!({"name": "Lightning Bolt", "colors": "[\"R\"]", "cardtype": "Instant", "typeline": "Instant", "cmc": 1.0}),
            json!({"name": "Lightning Bolt", "colors": "[\"R\"]", "cardtype": "Instant", "typeline": "Instant", "cmc": 1.0}),
        ];
        let p = build_profile_from_flat_cards(&cards, &cache);
        let result = compare(&p, &p);
        assert!((result.overall - 1.0).abs() < 1e-9, "identical deck should score 1.0, got {}", result.overall);
        assert!(result.shared_cards.contains(&"Lightning Bolt".to_string()));
        assert!(result.unique_to_a.is_empty());
        assert!(result.unique_to_b.is_empty());
    }

    #[test]
    fn test_compare_disjoint_decks() {
        let cache = HashMap::new();
        let cards_a = vec![json!({"name": "Card A", "colors": "[\"W\"]", "cardtype": "Creature", "typeline": "Creature", "cmc": 2.0})];
        let cards_b = vec![json!({"name": "Card B", "colors": "[\"B\"]", "cardtype": "Instant", "typeline": "Instant", "cmc": 3.0})];
        let pa = build_profile_from_flat_cards(&cards_a, &cache);
        let pb = build_profile_from_flat_cards(&cards_b, &cache);
        let result = compare(&pa, &pb);
        assert_eq!(result.classic.jaccard, 0.0, "disjoint decks should have 0 jaccard");
        assert!(result.unique_to_a.contains(&"Card A".to_string()));
        assert!(result.unique_to_b.contains(&"Card B".to_string()));
    }

    #[test]
    fn test_cmc_land_excluded() {
        let cache = HashMap::new();
        let cards = vec![json!({"name": "Plains", "colors": "[]", "cardtype": "Basic Land", "typeline": "Basic Land — Plains", "cmc": 0.0})];
        let p = build_profile_from_flat_cards(&cards, &cache);
        let tags = extract_tags_for_card(&cards[0], "mtg");
        // Land should not produce a cmc: tag
        assert!(!tags.iter().any(|t| t.starts_with("cmc:")), "lands should not get cmc tag");
        // CMC histogram should not be incremented for lands
        assert_eq!(p.cmc_histogram.iter().sum::<u32>(), 0, "land should not increment cmc histogram");
    }
}
