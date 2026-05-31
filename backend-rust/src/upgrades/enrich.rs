// Enrichment logic shared by the CLI binaries (src/bin/enrich_scryfall.rs,
// src/bin/fetch_edhrec.rs) and the admin HTTP endpoints. Pure async functions
// that take a pool and report the count of rows touched. Fail-soft on network
// errors so a single bad commander or card doesn't abort the whole job.

use std::time::Duration;

use anyhow::Result;
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::db::upgrades as db;

const USER_AGENT: &str = "tcg-singularity/0.1 (enrich@tcg-singularity.com)";
const SCRYFALL_BULK_INDEX: &str = "https://api.scryfall.com/bulk-data/oracle-cards";
const EDHREC_BASE: &str = "https://json.edhrec.com/pages/commanders";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

// ── Scryfall ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ScryfallBulkInfo {
    download_uri: String,
}

#[derive(Deserialize)]
struct ScryfallCard {
    name: String,
    #[serde(default)]
    prices: ScryfallPrices,
    #[serde(default)]
    legalities: serde_json::Value,
}

#[derive(Deserialize, Default)]
struct ScryfallPrices {
    #[serde(default)]
    usd: Option<String>,
}

fn http_client() -> Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(REQUEST_TIMEOUT)
        .build()?)
}

/// Download Scryfall's oracle-cards bulk dump and update price_usd +
/// legalities on every card in our local DB. Cards not in our DB are skipped
/// silently. Returns the number of local cards updated.
pub async fn refresh_scryfall(pool: &SqlitePool) -> Result<u32> {
    let client = http_client()?;

    tracing::info!("scryfall: fetching bulk-data manifest");
    let info: ScryfallBulkInfo = client
        .get(SCRYFALL_BULK_INDEX)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    tracing::info!("scryfall: downloading bulk dump from {}", info.download_uri);
    let bytes = client
        .get(&info.download_uri)
        .send()
        .await?
        .error_for_status()?
        .bytes()
        .await?;
    tracing::info!("scryfall: downloaded {} bytes, parsing", bytes.len());

    let cards: Vec<ScryfallCard> = serde_json::from_slice(&bytes)?;
    tracing::info!("scryfall: parsed {} cards, upserting", cards.len());

    let mut updated: u32 = 0;
    let mut seen: u32 = 0;
    for card in &cards {
        seen += 1;
        let price = card
            .prices
            .usd
            .as_deref()
            .and_then(|s| s.parse::<f64>().ok());
        let legalities = serde_json::to_string(&card.legalities).unwrap_or_else(|_| "{}".to_string());
        match db::upsert_card_enrichment(pool, &card.name, price, &legalities).await {
            Ok(n) if n > 0 => updated += 1,
            Ok(_) => {} // card not in local DB — skip
            Err(e) => tracing::warn!("scryfall: upsert failed for {}: {e}", card.name),
        }
        if seen.is_multiple_of(5000) {
            tracing::info!("scryfall: processed {seen}/{} ({updated} matched)", cards.len());
        }
    }

    tracing::info!("scryfall: done — {updated} cards updated out of {seen} scanned");
    Ok(updated)
}

// ── EDHREC ──────────────────────────────────────────────────────────────────

/// Lowercase a commander name and replace non-alphanumeric runs with dashes.
/// Matches EDHREC's URL convention: "Atraxa, Praetors' Voice" → "atraxa-praetors-voice".
pub fn slugify_commander(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut last_dash = true; // suppress leading dash
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    // strip trailing dash
    while out.ends_with('-') {
        out.pop();
    }
    out
}

/// Loosely-typed EDHREC card entry — fields we look up out of the nested
/// `container.json_dict.cardlists[].cardviews[]` structure.
#[derive(Deserialize, Debug)]
struct EdhrecCardView {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    num_decks: Option<f64>,
    #[serde(default)]
    potential_decks: Option<f64>,
    #[serde(default)]
    synergy: Option<f64>,
}

/// Parse the EDHREC JSON page for one commander into a flat list of
/// (card_name, inclusion_pct, synergy_lift). Defensive against schema drift
/// — anything we can't parse gets skipped silently.
pub fn parse_edhrec_page(body: &serde_json::Value) -> Vec<(String, Option<f64>, Option<f64>)> {
    let lists = body
        .pointer("/container/json_dict/cardlists")
        .and_then(|v| v.as_array());
    let Some(lists) = lists else {
        return vec![];
    };
    let mut out: Vec<(String, Option<f64>, Option<f64>)> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for list in lists {
        let Some(cardviews) = list.get("cardviews").and_then(|v| v.as_array()) else {
            continue;
        };
        for cv in cardviews {
            let Ok(view) = serde_json::from_value::<EdhrecCardView>(cv.clone()) else {
                continue;
            };
            let Some(name) = view.name else { continue };
            if !seen.insert(name.clone()) {
                continue;
            }
            let inclusion_pct = match (view.num_decks, view.potential_decks) {
                (Some(n), Some(p)) if p > 0.0 => Some((n / p) * 100.0),
                _ => None,
            };
            out.push((name, inclusion_pct, view.synergy));
        }
    }
    out
}

/// Fetch EDHREC pages for every distinct commander in the user-decks table.
/// Skips commanders refreshed within `cache_hours`. Continues past individual
/// 404s or network errors. Returns the number of commanders successfully
/// refreshed.
pub async fn refresh_edhrec(pool: &SqlitePool, cache_hours: i64) -> Result<u32> {
    let client = http_client()?;
    let commanders = db::list_distinct_commanders(pool).await?;
    tracing::info!("edhrec: {} distinct commanders to consider", commanders.len());

    let mut refreshed: u32 = 0;
    let mut skipped_fresh: u32 = 0;
    let mut failed: u32 = 0;

    for commander in &commanders {
        let slug = slugify_commander(commander);
        if slug.is_empty() {
            continue;
        }
        if db::edhrec_slug_fresh(pool, &slug, cache_hours).await.unwrap_or(false) {
            skipped_fresh += 1;
            continue;
        }

        let url = format!("{EDHREC_BASE}/{slug}.json");
        let res = client.get(&url).send().await;
        let body = match res {
            Ok(r) if r.status().is_success() => r.json::<serde_json::Value>().await,
            Ok(r) => {
                tracing::debug!("edhrec: {slug} returned {}", r.status());
                failed += 1;
                tokio::time::sleep(Duration::from_millis(100)).await;
                continue;
            }
            Err(e) => {
                tracing::debug!("edhrec: {slug} network error: {e}");
                failed += 1;
                tokio::time::sleep(Duration::from_millis(100)).await;
                continue;
            }
        };
        let entries = match body {
            Ok(v) => parse_edhrec_page(&v),
            Err(e) => {
                tracing::debug!("edhrec: {slug} parse error: {e}");
                failed += 1;
                continue;
            }
        };
        if entries.is_empty() {
            tracing::debug!("edhrec: {slug} yielded no card entries");
        }
        if let Err(e) = db::replace_edhrec_for_commander(pool, &slug, &entries).await {
            tracing::warn!("edhrec: replace failed for {slug}: {e}");
            failed += 1;
            continue;
        }
        refreshed += 1;
        // EDHREC's undocumented JSON endpoint — be polite (100ms between hits).
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    tracing::info!(
        "edhrec: done — refreshed={refreshed} cached={skipped_fresh} failed={failed}"
    );
    Ok(refreshed)
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify_commander("Edgar Markov"), "edgar-markov");
    }

    #[test]
    fn slugify_apostrophes_and_commas() {
        assert_eq!(
            slugify_commander("Atraxa, Praetors' Voice"),
            "atraxa-praetors-voice"
        );
    }

    #[test]
    fn slugify_hyphenated() {
        assert_eq!(slugify_commander("The Ur-Dragon"), "the-ur-dragon");
    }

    #[test]
    fn slugify_collapses_runs() {
        assert_eq!(
            slugify_commander("Kenrith,   the  Returned  King"),
            "kenrith-the-returned-king"
        );
    }

    #[test]
    fn slugify_strips_trailing() {
        assert_eq!(slugify_commander("Foo!?!"), "foo");
    }

    #[test]
    fn parse_edhrec_extracts_cards() {
        let body = json!({
            "container": { "json_dict": { "cardlists": [
                {
                    "header": "Top Cards",
                    "cardviews": [
                        { "name": "Sol Ring", "num_decks": 1000.0, "potential_decks": 1200.0, "synergy": 0.1 },
                        { "name": "Cyclonic Rift", "num_decks": 800.0, "potential_decks": 1200.0, "synergy": 0.3 }
                    ]
                },
                {
                    "header": "High Synergy",
                    "cardviews": [
                        { "name": "Sol Ring", "num_decks": 1000.0, "potential_decks": 1200.0, "synergy": 0.1 },
                        { "name": "Ghave, Guru of Spores", "num_decks": 50.0, "potential_decks": 1200.0, "synergy": 0.9 }
                    ]
                }
            ]}}
        });
        let entries = parse_edhrec_page(&body);
        let names: Vec<&str> = entries.iter().map(|(n, _, _)| n.as_str()).collect();
        // Sol Ring should appear only once (dedup across lists).
        assert_eq!(names.iter().filter(|n| **n == "Sol Ring").count(), 1);
        assert!(names.contains(&"Cyclonic Rift"));
        assert!(names.contains(&"Ghave, Guru of Spores"));

        let sol_ring = entries.iter().find(|(n, _, _)| n == "Sol Ring").unwrap();
        // 1000/1200 = 83.33%
        assert!((sol_ring.1.unwrap() - 83.33).abs() < 0.1);
        assert!((sol_ring.2.unwrap() - 0.1).abs() < 1e-9);
    }

    #[test]
    fn parse_edhrec_handles_missing_data() {
        let body = json!({ "container": { "json_dict": {} } });
        assert!(parse_edhrec_page(&body).is_empty());

        let empty = json!({});
        assert!(parse_edhrec_page(&empty).is_empty());
    }

    #[test]
    fn parse_edhrec_skips_zero_potential() {
        let body = json!({
            "container": { "json_dict": { "cardlists": [{
                "cardviews": [
                    { "name": "Zero Potential", "num_decks": 5.0, "potential_decks": 0.0, "synergy": 0.0 }
                ]
            }]}}
        });
        let entries = parse_edhrec_page(&body);
        assert_eq!(entries.len(), 1);
        assert!(entries[0].1.is_none());
    }
}
