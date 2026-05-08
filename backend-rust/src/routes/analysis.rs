use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;

use crate::analysis::{
    self, build_profile_from_decklist, build_profile_from_flat_cards, build_profile_from_rb_deck,
    compare, DeckEntry,
};
use crate::db;
use crate::routes::require_auth;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/analysis/similar", get(similar_to_deck))
        .route("/analysis/compare", post(compare_decks))
        .route("/analysis/precompute", get(precompute_tags))
        .route("/analysis/enrich-riftdecks", get(enrich_riftdecks))
        .with_state(pool)
}

// ── Request / response types ─────────────────────────────────────────────────

#[derive(Deserialize)]
struct SimilarQuery {
    deck_name: String,
    format: Option<String>,
    limit: Option<i64>,
    game: Option<String>,
}

#[derive(Deserialize)]
struct CompareBody {
    #[serde(rename = "deckA")]
    deck_a: DeckRef,
    #[serde(rename = "deckB")]
    deck_b: DeckRef,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum DeckRef {
    #[serde(rename = "user")]
    User { name: String },
    #[serde(rename = "tournament")]
    Tournament {
        #[serde(rename = "placementId")]
        placement_id: i64,
    },
}

#[derive(Serialize)]
struct SimilarResult {
    #[serde(rename = "placementId")]
    placement_id: i64,
    player: Option<String>,
    placement: Option<i64>,
    #[serde(rename = "eventName")]
    event_name: String,
    format: Option<String>,
    #[serde(rename = "overallScore")]
    overall_score: f64,
    #[serde(rename = "classicScore")]
    classic_score: f64,
    #[serde(rename = "semanticScore")]
    semantic_score: f64,
    jaccard: f64,
    cosine: f64,
    #[serde(rename = "colorScore")]
    color_score: f64,
    #[serde(rename = "cmcScore")]
    cmc_score: f64,
}

#[derive(Serialize)]
struct SimilarResponse {
    #[serde(rename = "deckName")]
    deck_name: String,
    format: String,
    results: Vec<SimilarResult>,
}

#[derive(Serialize)]
struct CompareResponse {
    #[serde(rename = "overallScore")]
    overall_score: f64,
    #[serde(rename = "classicScore")]
    classic_score: f64,
    #[serde(rename = "semanticScore")]
    semantic_score: f64,
    jaccard: f64,
    cosine: f64,
    #[serde(rename = "colorScore")]
    color_score: f64,
    #[serde(rename = "cmcScore")]
    cmc_score: f64,
    #[serde(rename = "sharedCards")]
    shared_cards: Vec<String>,
    #[serde(rename = "uniqueToA")]
    unique_to_a: Vec<String>,
    #[serde(rename = "uniqueToB")]
    unique_to_b: Vec<String>,
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async fn similar_to_deck(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Query(q): Query<SimilarQuery>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let game = q.game.as_deref().unwrap_or("mtg");
    let limit = q.limit.unwrap_or(20).min(100);

    match game {
        "riftbound" => similar_riftbound(&pool, &user, &q.deck_name, limit).await,
        _ => similar_mtg(&pool, &user, &q.deck_name, q.format.as_deref(), limit).await,
    }
}

async fn similar_mtg(
    pool: &SqlitePool,
    user: &str,
    deck_name: &str,
    format_override: Option<&str>,
    limit: i64,
) -> axum::response::Response {
    // Load user deck
    let deck = match db::analysis::load_user_deck(pool, deck_name, user).await {
        Ok(Some(d)) => d,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({"msg": "Deck not found"}))).into_response()
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };
    let (format, user_cards) = deck;
    let resolved_format = format_override.unwrap_or(&format).to_string();

    // Load tournament placements
    let placements = match db::analysis::load_tournament_placements_for_format(
        pool,
        "mtg",
        &resolved_format,
        limit * 5, // over-fetch, filter deck_url entries
    )
    .await
    {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };

    // Collect all card names from user deck + all tournament decklists
    let user_card_names: HashSet<String> = user_cards
        .iter()
        .filter_map(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();

    let mut all_names: HashSet<String> = user_card_names.clone();
    let parsed_placements: Vec<(i64, Option<String>, Option<i64>, Option<String>, String, Vec<DeckEntry>)> =
        placements
            .into_iter()
            .filter_map(|row| {
                let entries = parse_deck_entries(row.decklist.as_deref());
                // Skip deck_url-only rows
                let has_real_cards =
                    entries.iter().any(|e| e.card_type == "main" || e.card_type == "sideboard");
                if !has_real_cards {
                    return None;
                }
                for e in &entries {
                    if e.card_type == "main" {
                        all_names.insert(e.name.clone());
                    }
                }
                Some((row.id, row.player, row.placement, row.format, row.event_name, entries))
            })
            .collect();

    let all_names_vec: Vec<String> = all_names.into_iter().collect();

    // Batch load card details + tags
    let card_details = match db::analysis::load_cards_for_names(pool, &all_names_vec).await {
        Ok(d) => d,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };
    let tag_cache = match db::analysis::get_tags_for_cards(pool, &all_names_vec).await {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };

    // Build user deck profile
    let user_profile = build_profile_from_flat_cards(&user_cards, &tag_cache);

    // Score each tournament placement
    let mut results: Vec<SimilarResult> = parsed_placements
        .into_iter()
        .map(|(id, player, placement, format, event_name, entries)| {
            let profile = build_profile_from_decklist(&entries, &card_details, &tag_cache);
            let cmp = compare(&user_profile, &profile);
            SimilarResult {
                placement_id: id,
                player,
                placement,
                event_name,
                format,
                overall_score: cmp.overall,
                classic_score: cmp.classic.combined,
                semantic_score: cmp.semantic_cosine,
                jaccard: cmp.classic.jaccard,
                cosine: cmp.classic.cosine,
                color_score: cmp.classic.color_profile,
                cmc_score: cmp.classic.cmc_curve,
            }
        })
        .collect();

    results.sort_by(|a, b| b.overall_score.partial_cmp(&a.overall_score).unwrap());
    results.truncate(limit as usize);

    Json(SimilarResponse {
        deck_name: deck_name.to_string(),
        format: resolved_format,
        results,
    })
    .into_response()
}

async fn similar_riftbound(
    pool: &SqlitePool,
    user: &str,
    deck_name: &str,
    limit: i64,
) -> axum::response::Response {
    let deck = match db::analysis::load_rb_user_deck(pool, deck_name, user).await {
        Ok(Some(d)) => d,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({"msg": "Deck not found"}))).into_response()
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };
    let (format, _champion, entries) = deck;

    let ids: Vec<String> = entries.iter().map(|e| e.name.clone()).collect();
    let card_details = match db::analysis::load_rb_cards_for_ids(pool, &ids).await {
        Ok(d) => d,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };
    let tag_cache = match db::analysis::get_tags_for_cards(pool, &ids).await {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };

    let user_profile = build_profile_from_rb_deck(&entries, &card_details, &tag_cache);

    // Load Riftbound tournament placements (enriched ones only)
    let placements = match db::analysis::load_tournament_placements_for_format(
        pool,
        "riftbound",
        &format,
        limit * 5,
    )
    .await
    {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };

    // Collect all rb card IDs from tournament decklists
    let mut all_ids: HashSet<String> = ids.into_iter().collect();
    let parsed: Vec<(i64, Option<String>, Option<i64>, Option<String>, String, Vec<DeckEntry>)> =
        placements
            .into_iter()
            .filter_map(|row| {
                let entries = parse_deck_entries(row.decklist.as_deref());
                let has_real = entries.iter().any(|e| e.card_type == "main");
                if !has_real {
                    return None;
                }
                for e in &entries {
                    all_ids.insert(e.name.clone());
                }
                Some((row.id, row.player, row.placement, row.format, row.event_name, entries))
            })
            .collect();

    if parsed.is_empty() {
        return Json(SimilarResponse {
            deck_name: deck_name.to_string(),
            format,
            results: vec![],
        })
        .into_response();
    }

    let all_ids_vec: Vec<String> = all_ids.into_iter().collect();
    let all_cards = match db::analysis::load_rb_cards_for_ids(pool, &all_ids_vec).await {
        Ok(d) => d,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };
    let all_tags = match db::analysis::get_tags_for_cards(pool, &all_ids_vec).await {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"msg": e.to_string()})),
            )
                .into_response()
        }
    };

    let mut results: Vec<SimilarResult> = parsed
        .into_iter()
        .map(|(id, player, placement, format, event_name, entries)| {
            let profile = build_profile_from_rb_deck(&entries, &all_cards, &all_tags);
            let cmp = compare(&user_profile, &profile);
            SimilarResult {
                placement_id: id,
                player,
                placement,
                event_name,
                format,
                overall_score: cmp.overall,
                classic_score: cmp.classic.combined,
                semantic_score: cmp.semantic_cosine,
                jaccard: cmp.classic.jaccard,
                cosine: cmp.classic.cosine,
                color_score: cmp.classic.color_profile,
                cmc_score: cmp.classic.cmc_curve,
            }
        })
        .collect();

    results.sort_by(|a, b| b.overall_score.partial_cmp(&a.overall_score).unwrap());
    results.truncate(limit as usize);

    Json(SimilarResponse {
        deck_name: deck_name.to_string(),
        format,
        results,
    })
    .into_response()
}

async fn compare_decks(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(body): Json<CompareBody>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };

    let (profile_a, key_a) = match resolve_deck_ref(&pool, &user, &body.deck_a).await {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"msg": format!("deck_a: {e}")})),
            )
                .into_response()
        }
    };
    let (profile_b, _) = match resolve_deck_ref(&pool, &user, &body.deck_b).await {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"msg": format!("deck_b: {e}")})),
            )
                .into_response()
        }
    };
    let _ = key_a; // keys only used for error messages if needed

    let cmp = compare(&profile_a, &profile_b);
    Json(CompareResponse {
        overall_score: cmp.overall,
        classic_score: cmp.classic.combined,
        semantic_score: cmp.semantic_cosine,
        jaccard: cmp.classic.jaccard,
        cosine: cmp.classic.cosine,
        color_score: cmp.classic.color_profile,
        cmc_score: cmp.classic.cmc_curve,
        shared_cards: cmp.shared_cards,
        unique_to_a: cmp.unique_to_a,
        unique_to_b: cmp.unique_to_b,
    })
    .into_response()
}

async fn precompute_tags(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }
    let pool_clone = pool.clone();
    tokio::spawn(async move {
        let mut count = 0u32;
        // MTG cards
        match db::analysis::load_all_card_names_and_oracle(&pool_clone).await {
            Ok(cards) => {
                for (name, card_json) in &cards {
                    let tags = analysis::extract_tags_for_card(card_json, "mtg");
                    if let Err(e) = db::analysis::upsert_tags(&pool_clone, name, &tags).await {
                        tracing::warn!("precompute: failed to upsert tags for {name}: {e}");
                    }
                    count += 1;
                }
                tracing::info!("precompute: processed {count} MTG cards");
            }
            Err(e) => tracing::error!("precompute: failed to load MTG cards: {e}"),
        }
        // Riftbound cards
        match db::analysis::load_all_rb_card_ids_and_data(&pool_clone).await {
            Ok(cards) => {
                let mut rb_count = 0u32;
                for (id, card_json) in &cards {
                    let tags = analysis::extract_tags_for_card(card_json, "riftbound");
                    if let Err(e) = db::analysis::upsert_tags(&pool_clone, id, &tags).await {
                        tracing::warn!("precompute: failed to upsert RB tags for {id}: {e}");
                    }
                    rb_count += 1;
                }
                tracing::info!("precompute: processed {rb_count} Riftbound cards");
            }
            Err(e) => tracing::error!("precompute: failed to load Riftbound cards: {e}"),
        }
    });

    Json(json!({"msg": "Tag precomputation started", "status": "ok"})).into_response()
}

async fn enrich_riftdecks(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }

    let script = match resolve_enrich_script() {
        Ok(p) => p,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()})))
                .into_response()
        }
    };

    let pool_clone = pool.clone();
    tokio::spawn(async move {
        tracing::info!("enrich-riftdecks: launching enrichment script at {script:?}");

        let output = tokio::process::Command::new("python3")
            .arg(&script)
            .output()
            .await;

        match output {
            Err(e) => tracing::error!("enrich-riftdecks: failed to run script: {e}"),
            Ok(out) => {
                if !out.stderr.is_empty() {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    for line in stderr.lines() {
                        tracing::debug!("enrich-riftdecks stderr: {line}");
                    }
                }
                if !out.status.success() {
                    tracing::error!(
                        "enrich-riftdecks: script exited with code {}",
                        out.status.code().unwrap_or(-1)
                    );
                    return;
                }
                let json_str = String::from_utf8_lossy(&out.stdout);
                #[derive(serde::Deserialize)]
                struct EnrichedRow {
                    id: i64,
                    decklist: String,
                }
                let rows: Vec<EnrichedRow> =
                    serde_json::from_str(&json_str).unwrap_or_default();
                let mut enriched = 0u32;
                for row in rows {
                    if let Err(e) =
                        db::tournaments::update_placement_decklist(&pool_clone, row.id, &row.decklist).await
                    {
                        tracing::warn!("enrich-riftdecks: failed to update placement {}: {e}", row.id);
                    } else {
                        enriched += 1;
                    }
                }
                tracing::info!("enrich-riftdecks: enriched {enriched} placements");
            }
        }
    });

    Json(json!({"msg": "Riftdecks enrichment started", "status": "ok"})).into_response()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn parse_deck_entries(json: Option<&str>) -> Vec<DeckEntry> {
    let Some(s) = json else {
        return vec![];
    };
    #[derive(serde::Deserialize)]
    struct Raw {
        name: String,
        #[serde(default)]
        qty: u32,
        card_type: String,
    }
    let raws: Vec<Raw> = serde_json::from_str(s).unwrap_or_default();
    raws.into_iter()
        .map(|r| DeckEntry { name: r.name, qty: r.qty, card_type: r.card_type })
        .collect()
}

async fn resolve_deck_ref(
    pool: &SqlitePool,
    user: &str,
    deck_ref: &DeckRef,
) -> anyhow::Result<(analysis::DeckProfile, String)> {
    match deck_ref {
        DeckRef::User { name } => {
            let (format, cards) = db::analysis::load_user_deck(pool, name, user)
                .await?
                .ok_or_else(|| anyhow::anyhow!("deck '{name}' not found"))?;
            // Get tag cache for all card names
            let card_names: Vec<String> = cards
                .iter()
                .filter_map(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect();
            let tag_cache = db::analysis::get_tags_for_cards(pool, &card_names).await?;
            let profile = build_profile_from_flat_cards(&cards, &tag_cache);
            Ok((profile, format))
        }
        DeckRef::Tournament { placement_id } => {
            let (format, entries) =
                db::analysis::load_tournament_placement(pool, *placement_id)
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("placement {placement_id} not found"))?;
            let card_names: Vec<String> = entries
                .iter()
                .filter(|e| e.card_type == "main")
                .map(|e| e.name.clone())
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect();
            let card_details = db::analysis::load_cards_for_names(pool, &card_names).await?;
            let tag_cache = db::analysis::get_tags_for_cards(pool, &card_names).await?;
            let profile = build_profile_from_decklist(&entries, &card_details, &tag_cache);
            Ok((profile, format))
        }
    }
}

fn resolve_enrich_script() -> anyhow::Result<PathBuf> {
    const SCRIPT: &str = "scripts/enrich_riftdecks.py";
    let candidates = [
        PathBuf::from(SCRIPT),
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join(SCRIPT)))
            .unwrap_or_default(),
        PathBuf::from("backend-rust").join(SCRIPT),
    ];
    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }
    Err(anyhow::anyhow!(
        "enrich_riftdecks.py not found (looked for {SCRIPT})"
    ))
}
