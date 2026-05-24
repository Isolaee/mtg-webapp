// Upgrade-feature HTTP endpoints:
//   POST /api/upgrades                  — per-deck strict + sidegrade + land advice (auth)
//   POST /api/upgrades/refresh-scryfall — admin enrichment trigger
//   POST /api/upgrades/refresh-edhrec   — admin enrichment trigger

use std::collections::{HashMap, HashSet};

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

use crate::db;
use crate::routes::{require_admin, require_auth};
use crate::upgrades::engine::{build_engine_card, build_report, EngineCard};
use crate::upgrades::enrich::{refresh_edhrec, refresh_scryfall, slugify_commander};
use crate::upgrades::karsten::{analyze_mana_base, ManaCard};

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/upgrades", post(handle_propose_upgrades))
        .route("/upgrades/refresh-scryfall", post(handle_refresh_scryfall))
        .route("/upgrades/refresh-edhrec", post(handle_refresh_edhrec))
        .with_state(pool)
}

#[derive(Deserialize)]
struct UpgradesRequest {
    #[serde(rename = "deckName")]
    deck_name: String,
    #[serde(default)]
    format: Option<String>,
}

async fn handle_propose_upgrades(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(body): Json<UpgradesRequest>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };

    let (deck_format, commander, deck_cards_raw) =
        match db::upgrades::load_user_deck_full(&pool, &body.deck_name, &user).await {
            Ok(Some(d)) => d,
            Ok(None) => {
                return (StatusCode::NOT_FOUND, Json(json!({"msg": "Deck not found"})))
                    .into_response()
            }
            Err(e) => {
                tracing::error!("upgrades: load_user_deck_full failed: {e:#}");
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal error"})))
                    .into_response();
            }
        };

    let format = body.format.unwrap_or(deck_format);

    // Dedup deck card names (deck JSON is one entry per copy).
    let deck_names: Vec<String> = deck_cards_raw
        .iter()
        .filter_map(|c| c.get("name").and_then(|v| v.as_str()).map(String::from))
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    // Pull tags for everything we'll touch — deck cards first.
    let deck_tag_cache = match db::analysis::get_tags_for_cards(&pool, &deck_names).await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("upgrades: get_tags_for_cards (deck) failed: {e:#}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal error"})))
                .into_response();
        }
    };
    let deck_card_details = match db::analysis::load_cards_for_names(&pool, &deck_names).await {
        Ok(d) => d,
        Err(e) => {
            tracing::error!("upgrades: load_cards_for_names (deck) failed: {e:#}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal error"})))
                .into_response();
        }
    };

    // Build deck EngineCards. Deck-card legality is irrelevant (it's in the
    // deck already) — set is_legal=true so the symmetric predicate checks pass.
    let mut deck_engine_cards: Vec<EngineCard> = Vec::with_capacity(deck_names.len());
    let mut deck_color_identity: HashSet<char> = HashSet::new();
    for name in &deck_names {
        let Some(row) = deck_card_details.get(name) else {
            continue;
        };
        let tags = deck_tag_cache.get(name).cloned().unwrap_or_default();
        let ec = build_engine_card(row, &tags, true);
        for c in &ec.color_identity {
            deck_color_identity.insert(*c);
        }
        deck_engine_cards.push(ec);
    }
    let deck_ci_chars: Vec<char> = deck_color_identity.iter().copied().collect();

    // Candidate pool — pre-filtered by color identity at the SQL level.
    let candidate_rows = match db::upgrades::load_candidate_cards(&pool, &format, &deck_ci_chars).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("upgrades: load_candidate_cards failed: {e:#}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal error"})))
                .into_response();
        }
    };
    let candidate_names: Vec<String> = candidate_rows
        .iter()
        .filter_map(|(v, _)| v.get("name").and_then(|n| n.as_str()).map(String::from))
        .collect();
    let candidate_tag_cache = match db::analysis::get_tags_for_cards(&pool, &candidate_names).await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("upgrades: get_tags_for_cards (candidates) failed: {e:#}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal error"})))
                .into_response();
        }
    };

    let candidate_engine_cards: Vec<EngineCard> = candidate_rows
        .iter()
        .map(|(row, is_legal)| {
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let tags = candidate_tag_cache.get(name).cloned().unwrap_or_default();
            build_engine_card(row, &tags, *is_legal)
        })
        .collect();

    // EDHREC inclusion lookup keyed by commander slug.
    let edhrec: HashMap<String, f64> = match commander.as_deref() {
        Some(c) if !c.trim().is_empty() => {
            let slug = slugify_commander(c);
            db::upgrades::load_edhrec_inclusion(&pool, &slug)
                .await
                .unwrap_or_default()
        }
        _ => HashMap::new(),
    };

    let report = build_report(&deck_engine_cards, &candidate_engine_cards, &edhrec, 5, &format);

    // Land advice — bolt Karsten onto the response when we have the data.
    let mana_cards = build_mana_cards(&deck_cards_raw, &deck_tag_cache);
    let land_advice = analyze_mana_base(&mana_cards, &format);

    Json(json!({
        "format": report.format,
        "swaps": report.swaps,
        "holistic": report.holistic,
        "landAdvice": land_advice,
    }))
    .into_response()
}

/// Build ManaCard inputs for the Karsten advisor from the raw deck JSON
/// rows (one row per copy in the deck blob).
fn build_mana_cards(
    deck_cards_raw: &[serde_json::Value],
    deck_tag_cache: &HashMap<String, Vec<String>>,
) -> Vec<ManaCard> {
    let mut counts: HashMap<String, (serde_json::Value, u32)> = HashMap::new();
    for card in deck_cards_raw {
        let Some(name) = card.get("name").and_then(|v| v.as_str()) else {
            continue;
        };
        counts
            .entry(name.to_string())
            .and_modify(|(_, q)| *q += 1)
            .or_insert_with(|| (card.clone(), 1));
    }
    counts
        .into_iter()
        .map(|(name, (card, qty))| {
            let mana_cost = card.get("manacost").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let cmc = card.get("cmc").and_then(|v| v.as_f64()).unwrap_or(0.0) as u8;
            let cardtype = card.get("cardtype").and_then(|v| v.as_str()).unwrap_or("");
            let is_land = cardtype.to_lowercase().contains("land");
            // For lands, derive produced colors from color_identity (best guess
            // without enrichment-supplied produces_mana data).
            let produces: Vec<char> = if is_land {
                card.get("coloridentity")
                    .and_then(|v| v.as_str())
                    .map(|s| {
                        let parsed: Vec<String> = serde_json::from_str(s).unwrap_or_default();
                        parsed
                            .into_iter()
                            .filter_map(|x| x.chars().next().map(|c| c.to_ascii_uppercase()))
                            .filter(|c| matches!(c, 'W' | 'U' | 'B' | 'R' | 'G'))
                            .collect()
                    })
                    .unwrap_or_default()
            } else {
                vec![]
            };
            let is_ramp = deck_tag_cache
                .get(&name)
                .map(|t| t.iter().any(|x| x == "mana_acceleration"))
                .unwrap_or(false);
            ManaCard {
                name,
                mana_cost,
                cmc,
                is_land,
                produces,
                is_ramp,
                qty,
            }
        })
        .collect()
}

async fn handle_refresh_scryfall(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }
    if let Err(r) = require_admin(&headers) {
        return r;
    }

    let pool_clone = pool.clone();
    tokio::spawn(async move {
        match refresh_scryfall(&pool_clone).await {
            Ok(n) => tracing::info!("refresh_scryfall completed: {n} cards updated"),
            Err(e) => tracing::error!("refresh_scryfall failed: {e:#}"),
        }
    });

    Json(json!({
        "msg": "Scryfall enrichment started",
        "status": "ok"
    }))
    .into_response()
}

async fn handle_refresh_edhrec(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }
    if let Err(r) = require_admin(&headers) {
        return r;
    }

    let pool_clone = pool.clone();
    tokio::spawn(async move {
        match refresh_edhrec(&pool_clone, 24).await {
            Ok(n) => tracing::info!("refresh_edhrec completed: {n} commanders refreshed"),
            Err(e) => tracing::error!("refresh_edhrec failed: {e:#}"),
        }
    });

    Json(json!({
        "msg": "EDHREC enrichment started",
        "status": "ok"
    }))
    .into_response()
}
