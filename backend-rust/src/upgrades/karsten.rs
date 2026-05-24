// Mana-base advisor based on Frank Karsten's published heuristics.
// 60-card baseline: 14/19/22 sources for 1/2/3-pip costs.
// Commander scales by 99/60 ≈ 1.65 → 22/29/36.
// Total-land heuristic for Commander: 27 + 3.0·avg_mv − 0.3·ramp_count,
// clamped to [33, 40]. Fit to Karsten's published table (33/34/36/38/40 lands
// for avg MV 2.0/2.5/3.0/3.5/4.0). 60-card formats use a curve-driven count
// clamped to [20, 28].

use std::collections::HashMap;

use serde::Serialize;

/// Minimal input shape for a single card in the deck. Caller is responsible for
/// pre-parsing oracle text / coloridentity into these fields — this module is pure.
#[derive(Debug, Clone)]
pub struct ManaCard {
    pub name: String,
    /// Raw mana cost string, e.g. "{2}{U}{U}". Empty for lands.
    pub mana_cost: String,
    /// Converted mana value (lands count as 0).
    pub cmc: u8,
    pub is_land: bool,
    /// For lands: colors the land can produce. Empty for basics-of-no-color
    /// (Wastes) or noncreature spells. Use uppercase WUBRG.
    pub produces: Vec<char>,
    /// True if this card's effect ramps mana (e.g. Sol Ring, Cultivate).
    /// Callers can derive this from the existing `mana_acceleration` semantic tag.
    pub is_ramp: bool,
    /// Quantity in the deck (1 in singleton formats, up to 4 in 60-card).
    pub qty: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorSourceAdvice {
    pub color: char,
    pub current_sources: u32,
    pub needed_sources: u32,
    pub max_pip_demand: u8,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManaReport {
    pub format: String,
    pub recommended_total_lands: u32,
    pub current_total_lands: u32,
    pub avg_mv: f64,
    pub ramp_count: u32,
    /// One entry per color the deck demands; sorted W, U, B, R, G.
    pub per_color: Vec<ColorSourceAdvice>,
    /// Lands that produce colors the deck barely uses — candidates to cut.
    pub suggested_cuts: Vec<String>,
    /// Generic textual suggestions ("Add 4 more blue sources").
    pub suggested_adds: Vec<String>,
}

const COLORS: [char; 5] = ['W', 'U', 'B', 'R', 'G'];

/// Karsten 60-card source table. Index by pip count.
fn sources_for_pip_60(pip: u8) -> u32 {
    match pip {
        0 => 0,
        1 => 14,
        2 => 19,
        3 => 22,
        _ => 23,
    }
}

/// Karsten Commander source table (≈ 60-card × 99/60).
fn sources_for_pip_commander(pip: u8) -> u32 {
    match pip {
        0 => 0,
        1 => 22,
        2 => 29,
        3 => 36,
        _ => 38,
    }
}

fn is_commander_format(format: &str) -> bool {
    matches!(format.to_lowercase().as_str(), "commander" | "brawl" | "edh")
}

/// Count colored pips per color symbol in a single mana cost string.
/// `{2}{W}{W}` → {'W': 2}. Hybrid `{W/U}` contributes 1 to BOTH colors
/// (caller can interpret as "either works", which matches Karsten's note that
/// hybrid lets you pick whichever source you already have).
/// Phyrexian `{W/P}` counts as 1 W pip (you'd rather pay mana than 2 life).
fn count_pips(mana_cost: &str) -> HashMap<char, u8> {
    let mut counts: HashMap<char, u8> = HashMap::new();
    let mut chars = mana_cost.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '{' {
            continue;
        }
        let mut symbol = String::new();
        for sc in chars.by_ref() {
            if sc == '}' {
                break;
            }
            symbol.push(sc);
        }
        let up = symbol.to_uppercase();
        // Hybrid like "W/U" or "W/P"
        if up.contains('/') {
            for part in up.split('/') {
                if part.len() == 1 {
                    let ch = part.chars().next().unwrap();
                    if COLORS.contains(&ch) {
                        *counts.entry(ch).or_insert(0) += 1;
                    }
                }
            }
            continue;
        }
        // Plain colored symbol
        if up.len() == 1 {
            let ch = up.chars().next().unwrap();
            if COLORS.contains(&ch) {
                *counts.entry(ch).or_insert(0) += 1;
            }
        }
        // Generic {2}, {X}, {C} contribute nothing colored.
    }
    counts
}

/// Recommended total land count for the deck given its curve and ramp.
pub fn recommended_land_count(avg_mv: f64, ramp_count: u32, deck_size: u32, format: &str) -> u32 {
    if is_commander_format(format) {
        // Karsten 2022 table fit: 27 + 3.0·avg_mv − 0.3·ramp_count, clamp [33, 40].
        let raw = 27.0 + 3.0 * avg_mv - 0.3 * (ramp_count as f64);
        raw.round().clamp(33.0, 40.0) as u32
    } else if deck_size >= 90 {
        // Non-Commander 100-card (rare).
        let raw = 27.0 + 3.0 * avg_mv - 0.3 * (ramp_count as f64);
        raw.round().clamp(35.0, 42.0) as u32
    } else {
        // 60-card heuristic: 22 + (avg_mv − 2.0) × 2.0, clamp [20, 28].
        // Higher curves want more lands; aggressive low-curve decks can go down to 20.
        let raw = 22.0 + (avg_mv - 2.0) * 2.0 - 0.4 * (ramp_count as f64);
        raw.round().clamp(20.0, 28.0) as u32
    }
}

/// Sources needed for a given pip demand on the given format.
pub fn sources_per_color(pip_demand: u8, format: &str) -> u32 {
    if is_commander_format(format) {
        sources_for_pip_commander(pip_demand)
    } else {
        sources_for_pip_60(pip_demand)
    }
}

/// Full mana-base analysis. Returns a `ManaReport` describing total-land
/// recommendations, per-color source gaps, and candidate cuts.
pub fn analyze_mana_base(cards: &[ManaCard], format: &str) -> ManaReport {
    // ── Totals ──────────────────────────────────────────────────────────────
    let mut deck_size: u32 = 0;
    let mut current_total_lands: u32 = 0;
    let mut total_cmc: f64 = 0.0;
    let mut nonland_count: u32 = 0;
    let mut ramp_count: u32 = 0;

    // Max pip demand per color seen on any single card in the deck.
    let mut max_pip: HashMap<char, u8> = HashMap::new();
    // Current sources per color (sum of qty for each land that produces it).
    let mut current_sources: HashMap<char, u32> = HashMap::new();

    for card in cards {
        deck_size += card.qty;
        if card.is_land {
            current_total_lands += card.qty;
            for color in &card.produces {
                *current_sources.entry(*color).or_insert(0) += card.qty;
            }
            continue;
        }
        nonland_count += card.qty;
        total_cmc += (card.cmc as f64) * (card.qty as f64);
        if card.is_ramp {
            ramp_count += card.qty;
        }
        let pips = count_pips(&card.mana_cost);
        for (color, count) in pips {
            let entry = max_pip.entry(color).or_insert(0);
            if count > *entry {
                *entry = count;
            }
        }
    }

    let avg_mv = if nonland_count == 0 {
        0.0
    } else {
        total_cmc / (nonland_count as f64)
    };

    let recommended_total_lands = recommended_land_count(avg_mv, ramp_count, deck_size, format);

    // ── Per-color advice ────────────────────────────────────────────────────
    let mut per_color: Vec<ColorSourceAdvice> = COLORS
        .iter()
        .filter_map(|c| {
            let pip = *max_pip.get(c).unwrap_or(&0);
            if pip == 0 {
                return None;
            }
            Some(ColorSourceAdvice {
                color: *c,
                current_sources: *current_sources.get(c).unwrap_or(&0),
                needed_sources: sources_per_color(pip, format),
                max_pip_demand: pip,
            })
        })
        .collect();
    per_color.sort_by_key(|a| a.color);

    // ── Suggested cuts: lands producing only colors the deck doesn't demand ─
    let demanded: std::collections::HashSet<char> = max_pip
        .iter()
        .filter(|(_, p)| **p > 0)
        .map(|(c, _)| *c)
        .collect();
    let mut suggested_cuts: Vec<String> = cards
        .iter()
        .filter(|c| c.is_land && !c.produces.is_empty())
        .filter(|c| c.produces.iter().all(|p| !demanded.contains(p)))
        .map(|c| c.name.clone())
        .collect();
    suggested_cuts.sort();
    suggested_cuts.dedup();

    // ── Suggested adds: generic text per color short on sources ─────────────
    let suggested_adds: Vec<String> = per_color
        .iter()
        .filter(|a| a.current_sources < a.needed_sources)
        .map(|a| {
            let color_name = match a.color {
                'W' => "white",
                'U' => "blue",
                'B' => "black",
                'R' => "red",
                'G' => "green",
                _ => "colored",
            };
            let gap = a.needed_sources - a.current_sources;
            format!(
                "Add {gap} more {color_name} source{} (need {} for {}-pip costs, have {})",
                if gap == 1 { "" } else { "s" },
                a.needed_sources,
                a.max_pip_demand,
                a.current_sources
            )
        })
        .collect();

    ManaReport {
        format: format.to_string(),
        recommended_total_lands,
        current_total_lands,
        avg_mv,
        ramp_count,
        per_color,
        suggested_cuts,
        suggested_adds,
    }
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn nonland(name: &str, mana_cost: &str, cmc: u8) -> ManaCard {
        ManaCard {
            name: name.to_string(),
            mana_cost: mana_cost.to_string(),
            cmc,
            is_land: false,
            produces: vec![],
            is_ramp: false,
            qty: 1,
        }
    }

    fn land(name: &str, produces: &[char], qty: u32) -> ManaCard {
        ManaCard {
            name: name.to_string(),
            mana_cost: String::new(),
            cmc: 0,
            is_land: true,
            produces: produces.to_vec(),
            is_ramp: false,
            qty,
        }
    }

    #[test]
    fn pip_counting_basic() {
        let p = count_pips("{2}{U}{U}");
        assert_eq!(p.get(&'U'), Some(&2));
        assert!(!p.contains_key(&'W'));
    }

    #[test]
    fn pip_counting_hybrid_counts_both() {
        let p = count_pips("{W/U}{W/U}");
        assert_eq!(p.get(&'W'), Some(&2));
        assert_eq!(p.get(&'U'), Some(&2));
    }

    #[test]
    fn pip_counting_phyrexian() {
        let p = count_pips("{W/P}");
        assert_eq!(p.get(&'W'), Some(&1));
    }

    #[test]
    fn pip_counting_generic_only() {
        let p = count_pips("{4}");
        assert!(p.is_empty());
    }

    #[test]
    fn recommended_lands_60_card_aggro() {
        // Mono-red aggro, avg MV 2.0, no ramp → 22 lands.
        let n = recommended_land_count(2.0, 0, 60, "modern");
        assert!((22..=24).contains(&n), "expected 22-24, got {n}");
    }

    #[test]
    fn recommended_lands_commander_midrange() {
        // 4-color goodstuff avg MV 3.5, 6 ramp pieces → ~37-38.
        let n = recommended_land_count(3.5, 6, 99, "commander");
        assert!((36..=39).contains(&n), "expected 36-39, got {n}");
    }

    #[test]
    fn recommended_lands_commander_clamps_high() {
        // Top-end "lands matter" deck: avg MV 6, no ramp → clamp at 40.
        let n = recommended_land_count(6.0, 0, 99, "commander");
        assert_eq!(n, 40);
    }

    #[test]
    fn recommended_lands_commander_clamps_low() {
        // Hyper-cheap ramp-heavy deck: avg MV 1.0, 20 ramp → clamp at 33.
        let n = recommended_land_count(1.0, 20, 99, "commander");
        assert_eq!(n, 33);
    }

    #[test]
    fn triple_pip_60_card_demands_22_sources() {
        // Cryptic Command-like {1}{U}{U}{U}: max U pip = 3 → 22 blue sources.
        assert_eq!(sources_per_color(3, "modern"), 22);
    }

    #[test]
    fn triple_pip_commander_demands_36_sources() {
        assert_eq!(sources_per_color(3, "commander"), 36);
    }

    #[test]
    fn analyze_flags_wrong_color_land_as_cut() {
        // Deck is mono-blue but contains a Plains (produces W, not demanded).
        let cards = vec![
            nonland("Counterspell", "{U}{U}", 2),
            land("Plains", &['W'], 1),
            land("Island", &['U'], 20),
        ];
        let report = analyze_mana_base(&cards, "modern");
        assert!(
            report.suggested_cuts.contains(&"Plains".to_string()),
            "Plains should be flagged for cut, got {:?}",
            report.suggested_cuts
        );
        assert!(!report.suggested_cuts.contains(&"Island".to_string()));
    }

    #[test]
    fn analyze_per_color_includes_only_demanded_colors() {
        let cards = vec![
            nonland("Lightning Bolt", "{R}", 1),
            nonland("Counterspell", "{U}{U}", 2),
            land("Island", &['U'], 10),
            land("Mountain", &['R'], 10),
        ];
        let report = analyze_mana_base(&cards, "modern");
        let colors: Vec<char> = report.per_color.iter().map(|a| a.color).collect();
        assert_eq!(colors, vec!['R', 'U']);
        // U pip demand is 2 → 19 sources needed, current 10 → gap of 9.
        let u_advice = report.per_color.iter().find(|a| a.color == 'U').unwrap();
        assert_eq!(u_advice.max_pip_demand, 2);
        assert_eq!(u_advice.needed_sources, 19);
        assert_eq!(u_advice.current_sources, 10);
    }

    #[test]
    fn analyze_suggested_adds_describe_gap() {
        let cards = vec![
            nonland("Cryptic Command", "{1}{U}{U}{U}", 4),
            land("Island", &['U'], 10),
        ];
        let report = analyze_mana_base(&cards, "modern");
        // 3-pip → 22 needed, have 10 → gap = 12.
        let has_blue_gap = report
            .suggested_adds
            .iter()
            .any(|s| s.contains("blue") && s.contains("12"));
        assert!(has_blue_gap, "expected blue-gap advice, got {:?}", report.suggested_adds);
    }

    #[test]
    fn analyze_empty_deck_does_not_panic() {
        let report = analyze_mana_base(&[], "modern");
        assert_eq!(report.current_total_lands, 0);
        assert_eq!(report.avg_mv, 0.0);
        assert!(report.per_color.is_empty());
    }

    #[test]
    fn analyze_dual_land_credits_both_colors() {
        // Hallowed Fountain produces W and U.
        let cards = vec![
            nonland("Spell A", "{W}{W}", 2),
            nonland("Spell B", "{U}{U}", 2),
            land("Hallowed Fountain", &['W', 'U'], 4),
            land("Plains", &['W'], 8),
            land("Island", &['U'], 8),
        ];
        let report = analyze_mana_base(&cards, "modern");
        let w = report.per_color.iter().find(|a| a.color == 'W').unwrap();
        let u = report.per_color.iter().find(|a| a.color == 'U').unwrap();
        // Each color sees 8 mono + 4 dual = 12 sources.
        assert_eq!(w.current_sources, 12);
        assert_eq!(u.current_sources, 12);
    }

    #[test]
    fn ramp_reduces_recommended_land_count() {
        let no_ramp = recommended_land_count(3.0, 0, 99, "commander");
        let with_ramp = recommended_land_count(3.0, 10, 99, "commander");
        assert!(
            with_ramp < no_ramp,
            "ramp should reduce lands: no_ramp={no_ramp}, with_ramp={with_ramp}"
        );
    }
}
