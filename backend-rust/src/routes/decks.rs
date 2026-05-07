use crate::db;
use axum::{
    extract::{Multipart, Query, State},
    http::StatusCode,
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
        .route("/list_decks", get(list_decks))
        .route("/load_deck", get(load_deck))
        .route("/save_deck", post(save_deck))
        .route("/upload_deck", post(upload_deck))
        .with_state(pool)
}

async fn list_decks(State(pool): State<SqlitePool>) -> impl IntoResponse {
    match db::decks::find_all(&pool).await {
        Ok(decks) => {
            let summaries: Vec<_> = decks
                .iter()
                .map(|d| json!({"deck_name": d.name, "deck_description": d.description}))
                .collect();
            Json(json!({"decks": summaries})).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}

#[derive(Deserialize)]
struct LoadDeckQuery {
    deck_name: Option<String>,
}

async fn load_deck(
    State(pool): State<SqlitePool>,
    Query(params): Query<LoadDeckQuery>,
) -> impl IntoResponse {
    let name = match &params.deck_name {
        Some(n) if !n.is_empty() => n.clone(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Missing deck_name parameter"}))).into_response(),
    };
    match db::decks::find_by_name(&pool, &name).await {
        Ok(Some(deck)) => Json(json!({
            "deck_name": deck.name,
            "deck_description": deck.description,
            "format": deck.format,
            "commander_name": deck.commander,
            "cards": deck.cards.as_deref().and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok()).unwrap_or(json!([])),
        })).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"msg": "Deck not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}

struct DeckForm {
    file_content: String,
    format: String,
    commander_name: String,
    deck_name: String,
    deck_description: String,
}

async fn parse_multipart(mut multipart: Multipart) -> anyhow::Result<DeckForm> {
    let mut file_content = String::new();
    let mut format = "commander".to_string();
    let mut commander_name = String::new();
    let mut deck_name = "Uploaded Deck".to_string();
    let mut deck_description = String::new();

    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "deckfile" => file_content = String::from_utf8_lossy(&field.bytes().await?).to_string(),
            "format" => format = field.text().await?,
            "commander_name" => commander_name = field.text().await?,
            "deck_name" => deck_name = field.text().await?,
            "deck_description" => deck_description = field.text().await?,
            _ => {}
        }
    }
    Ok(DeckForm { file_content, format, commander_name, deck_name, deck_description })
}

fn parse_card_list(content: &str, pool_ref: &SqlitePool) -> (Vec<String>, Option<String>) {
    // Returns (card name list with quantities, commander name if found)
    // Actual DB lookup happens in the route handlers
    let _ = pool_ref;
    let re = card_regex();
    let mut lines = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("//") {
            continue;
        }
        if let Some(caps) = re.captures(line) {
            let qty: usize = caps[1].parse().unwrap_or(1);
            let name = caps[2].trim().to_string();
            for _ in 0..qty {
                lines.push(name.clone());
            }
        }
    }
    (lines, None)
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
            let card_val = serde_json::to_value(card)?;
            if !commander_name.is_empty() && name.to_lowercase() == commander_name.to_lowercase() {
                commander_json = Some(card_val.clone());
            }
            cards_json.push(card_val);
        }
    }

    Ok((serde_json::Value::Array(cards_json), commander_json))
}

async fn upload_deck(
    State(pool): State<SqlitePool>,
    multipart: Multipart,
) -> impl IntoResponse {
    let form = match parse_multipart(multipart).await {
        Ok(f) => f,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({"msg": e.to_string()}))).into_response(),
    };

    if form.file_content.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "No file uploaded"}))).into_response();
    }

    let (card_names, _) = parse_card_list(&form.file_content, &pool);
    match build_deck_json(&pool, &card_names, &form.commander_name).await {
        Ok((cards, commander)) => Json(json!({
            "deck_name": form.deck_name,
            "format": form.format,
            "commander_name": form.commander_name,
            "commander": commander,
            "cards": cards,
        })).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}

async fn save_deck(
    State(pool): State<SqlitePool>,
    multipart: Multipart,
) -> impl IntoResponse {
    let form = match parse_multipart(multipart).await {
        Ok(f) => f,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({"msg": e.to_string()}))).into_response(),
    };

    if form.file_content.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "No file uploaded"}))).into_response();
    }

    let (card_names, _) = parse_card_list(&form.file_content, &pool);
    let (cards_val, commander_val) = match build_deck_json(&pool, &card_names, &form.commander_name).await {
        Ok(v) => v,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({"msg": e.to_string()}))).into_response(),
    };

    let cards_str = serde_json::to_string(&cards_val).unwrap_or_default();
    let commander_str = commander_val.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default());

    match db::decks::insert(
        &pool,
        &form.deck_name,
        Some(&form.deck_description).filter(|s| !s.is_empty()).map(|x| x.as_str()),
        &form.format,
        commander_str.as_deref(),
        Some(&cards_str),
    )
    .await
    {
        Ok(_) => Json(json!({"msg": "Deck saved successfully!"})).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response(),
    }
}
