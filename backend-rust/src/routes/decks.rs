use crate::db;
use crate::routes::require_auth;
use axum::{
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use regex::Regex;
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;
use std::sync::OnceLock;

static CARD_RE: OnceLock<Regex> = OnceLock::new();
fn card_regex() -> &'static Regex {
    CARD_RE.get_or_init(|| Regex::new(r"(?i)^(\d+)x?,?\s+(.+)$").unwrap())
}

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/decks", get(list_decks).post(save_deck))
        .route("/decks/:name", get(get_deck).delete(delete_deck))
        .route("/upload_deck", post(upload_deck))
        .with_state(pool)
}

async fn list_decks(State(pool): State<SqlitePool>, headers: HeaderMap) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    match db::decks::find_all_by_user(&pool, &user).await {
        Ok(decks) => {
            let summaries: Vec<_> = decks
                .iter()
                .map(|d| json!({"name": d.name, "description": d.description, "format": d.format}))
                .collect();
            Json(json!({"decks": summaries})).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}

async fn get_deck(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    match db::decks::find_by_name_and_user(&pool, &name, &user).await {
        Ok(Some(deck)) => Json(json!({
            "name": deck.name,
            "description": deck.description,
            "format": deck.format,
            "commander": deck.commander.as_deref()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok()),
            "cards": deck.cards.as_deref()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                .unwrap_or(json!([])),
        }))
        .into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"msg": "Deck not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}

#[derive(Deserialize)]
struct DeckSaveInput {
    name: String,
    format: String,
    description: Option<String>,
    commander: Option<serde_json::Value>,
    cards: Vec<serde_json::Value>,
}

async fn save_deck(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(input): Json<DeckSaveInput>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let commander_str = input
        .commander
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());
    let cards_str = serde_json::to_string(&input.cards).unwrap_or_default();
    match db::decks::insert(
        &pool,
        &input.name,
        input.description.as_deref(),
        &input.format,
        commander_str.as_deref(),
        Some(&cards_str),
        &user,
    )
    .await
    {
        Ok(_) => (StatusCode::CREATED, Json(json!({"msg": "Deck saved"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}

async fn delete_deck(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    match db::decks::delete_by_name_and_user(&pool, &name, &user).await {
        Ok(1..) => Json(json!({"msg": "Deck deleted"})).into_response(),
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"msg": "Deck not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}

// File-parse only — resolves card names against DB, returns deck data without saving
async fn upload_deck(State(pool): State<SqlitePool>, headers: HeaderMap, multipart: Multipart) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }
    let form = match parse_multipart(multipart).await {
        Ok(f) => f,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({"msg": e.to_string()}))).into_response(),
    };
    if form.file_content.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "No file uploaded"}))).into_response();
    }
    let card_names = parse_card_list(&form.file_content);
    if card_names.len() > 500 {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Deck exceeds 500 cards"}))).into_response();
    }
    match build_deck_json(&pool, &card_names, &form.commander_name).await {
        Ok((cards, commander)) => Json(json!({
            "name": form.deck_name,
            "format": form.format,
            "commander": commander,
            "cards": cards,
        }))
        .into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

struct DeckForm {
    file_content: String,
    format: String,
    commander_name: String,
    deck_name: String,
}

async fn parse_multipart(mut multipart: Multipart) -> anyhow::Result<DeckForm> {
    let mut file_content = String::new();
    let mut format = "commander".to_string();
    let mut commander_name = String::new();
    let mut deck_name = "Uploaded Deck".to_string();

    while let Some(field) = multipart.next_field().await? {
        match field.name().unwrap_or("") {
            "deckfile" => file_content = String::from_utf8_lossy(&field.bytes().await?).to_string(),
            "format" => format = field.text().await?,
            "commander_name" => commander_name = field.text().await?,
            "deck_name" => deck_name = field.text().await?,
            _ => {}
        }
    }
    Ok(DeckForm { file_content, format, commander_name, deck_name })
}

fn parse_card_list(content: &str) -> Vec<String> {
    let re = card_regex();
    let mut names = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("//") {
            continue;
        }
        if let Some(caps) = re.captures(line) {
            let qty: usize = caps[1].parse::<usize>().unwrap_or(1).min(99);
            let name = caps[2].trim().to_string();
            for _ in 0..qty {
                names.push(name.clone());
            }
        }
    }
    names
}

async fn build_deck_json(
    pool: &SqlitePool,
    card_names: &[String],
    commander_name: &str,
) -> anyhow::Result<(serde_json::Value, Option<serde_json::Value>)> {
    let unique: Vec<String> = {
        let mut seen = std::collections::HashSet::new();
        card_names.iter().filter(|n| seen.insert((*n).clone())).cloned().collect()
    };
    let found = db::cards::find_by_names(pool, &unique).await?;
    let card_map: std::collections::HashMap<String, _> =
        found.into_iter().map(|c| (c.name.to_lowercase(), c)).collect();

    let mut cards_json = Vec::new();
    let mut commander_json: Option<serde_json::Value> = None;
    for name in card_names {
        if let Some(card) = card_map.get(&name.to_lowercase()) {
            let val = serde_json::to_value(card)?;
            if !commander_name.is_empty() && name.to_lowercase() == commander_name.to_lowercase() {
                commander_json = Some(val.clone());
            }
            cards_json.push(val);
        }
    }
    Ok((serde_json::Value::Array(cards_json), commander_json))
}
