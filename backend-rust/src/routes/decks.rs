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
use uuid::Uuid;

static CARD_RE: OnceLock<Regex> = OnceLock::new();
fn card_regex() -> &'static Regex {
    CARD_RE.get_or_init(|| Regex::new(r"(?i)^(\d+)x?,?\s+(.+)$").unwrap())
}

// Short, unguessable share slug for public deck links (first 12 hex chars of a
// v4 UUID — ~48 bits, ample for this scale).
fn gen_slug() -> String {
    Uuid::new_v4().simple().to_string()[..12].to_string()
}

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/decks", get(list_decks).post(save_deck))
        .route("/decks/:name", get(get_deck).delete(delete_deck))
        // Unauthenticated read-only share view (only resolves public decks).
        .route("/public/decks/:slug", get(get_public_deck))
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
                .map(|d| json!({
                    "name": d.name,
                    "description": d.description,
                    "format": d.format,
                    "is_public": d.is_public.unwrap_or(0) != 0,
                    "share_slug": d.share_slug,
                }))
                .collect();
            Json(json!({"decks": summaries})).into_response()
        }
        Err(e) => {
            tracing::error!("decks db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
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
        Ok(Some(deck)) => Json(deck_to_json(&deck)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"msg": "Deck not found"}))).into_response(),
        Err(e) => {
            tracing::error!("decks db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

// Read-only public deck fetch by share slug. No auth required; only decks the
// owner marked public are resolvable. Returns the owner's username so the share
// page can attribute the deck.
async fn get_public_deck(
    State(pool): State<SqlitePool>,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    match db::decks::find_by_slug_public(&pool, &slug).await {
        Ok(Some(deck)) => {
            let mut body = deck_to_json(&deck);
            body["owner"] = json!(deck.user_id);
            Json(body).into_response()
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"msg": "Deck not found"}))).into_response(),
        Err(e) => {
            tracing::error!("decks db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

// Serialise a stored Deck row (JSON-text blobs) into the API response shape.
fn deck_to_json(deck: &crate::models::Deck) -> serde_json::Value {
    let parse = |s: Option<&str>| {
        s.and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
    };
    json!({
        "name": deck.name,
        "description": deck.description,
        "format": deck.format,
        "is_public": deck.is_public.unwrap_or(0) != 0,
        "share_slug": deck.share_slug,
        "commander": parse(deck.commander.as_deref()),
        "cards": parse(deck.cards.as_deref()).unwrap_or(json!([])),
        "sideboard": parse(deck.sideboard.as_deref()).unwrap_or(json!([])),
        "maybeboard": parse(deck.maybeboard.as_deref()).unwrap_or(json!([])),
    })
}

#[derive(Deserialize)]
struct DeckSaveInput {
    name: String,
    format: String,
    description: Option<String>,
    commander: Option<serde_json::Value>,
    cards: Vec<serde_json::Value>,
    #[serde(default)]
    sideboard: Vec<serde_json::Value>,
    #[serde(default)]
    maybeboard: Vec<serde_json::Value>,
    #[serde(default)]
    is_public: bool,
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
    let sideboard_str = serde_json::to_string(&input.sideboard).unwrap_or_default();
    let maybeboard_str = serde_json::to_string(&input.maybeboard).unwrap_or_default();
    // Preserve a deck's share slug across re-saves so its public link stays
    // stable; mint one on first save (every deck gets a slug, used only once
    // the owner flips it public).
    let share_slug = match db::decks::find_by_name_and_user(&pool, &input.name, &user).await {
        Ok(existing) => existing
            .and_then(|d| d.share_slug)
            .unwrap_or_else(gen_slug),
        Err(e) => {
            tracing::error!("decks db error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
        }
    };
    // Save-or-replace: drop any existing deck with the same name for this user so
    // re-saving updates in place instead of creating duplicate rows.
    if let Err(e) = db::decks::delete_by_name_and_user(&pool, &input.name, &user).await {
        tracing::error!("decks db error: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
    }
    match db::decks::insert(
        &pool,
        &input.name,
        input.description.as_deref(),
        &input.format,
        commander_str.as_deref(),
        Some(&cards_str),
        Some(&sideboard_str),
        Some(&maybeboard_str),
        &user,
        input.is_public,
        Some(&share_slug),
    )
    .await
    {
        Ok(_) => (StatusCode::CREATED, Json(json!({"msg": "Deck saved", "share_slug": share_slug, "is_public": input.is_public}))).into_response(),
        Err(e) => {
            tracing::error!("decks db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
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
        Err(e) => {
            tracing::error!("decks db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
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
    let parsed = parse_card_list(&form.file_content);
    let total = parsed.main.len() + parsed.side.len() + parsed.maybe.len();
    if total > 500 {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Deck exceeds 500 cards"}))).into_response();
    }
    match build_deck_json(&pool, &parsed, &form.commander_name).await {
        Ok((cards, sideboard, maybeboard, commander)) => Json(json!({
            "name": form.deck_name,
            "format": form.format,
            "commander": commander,
            "cards": cards,
            "sideboard": sideboard,
            "maybeboard": maybeboard,
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

struct ParsedDeck {
    main: Vec<String>,
    side: Vec<String>,
    maybe: Vec<String>,
}

// Recognise a section header line (e.g. "Sideboard", "Maybeboard:", "Deck").
// Returns which section subsequent lines belong to, or None if not a header.
fn section_header(line: &str) -> Option<Section> {
    let key = line.trim().trim_end_matches(':').to_lowercase();
    match key.as_str() {
        "main" | "mainboard" | "deck" | "commander" => Some(Section::Main),
        "sideboard" | "side" => Some(Section::Side),
        "maybeboard" | "maybe" => Some(Section::Maybe),
        _ => None,
    }
}

#[derive(Clone, Copy)]
enum Section {
    Main,
    Side,
    Maybe,
}

fn parse_card_list(content: &str) -> ParsedDeck {
    let re = card_regex();
    let mut parsed = ParsedDeck { main: Vec::new(), side: Vec::new(), maybe: Vec::new() };
    let mut section = Section::Main;
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("//") {
            continue;
        }
        if let Some(next) = section_header(line) {
            section = next;
            continue;
        }
        if let Some(caps) = re.captures(line) {
            let qty: usize = caps[1].parse::<usize>().unwrap_or(1).min(99);
            let name = caps[2].trim().to_string();
            let bucket = match section {
                Section::Main => &mut parsed.main,
                Section::Side => &mut parsed.side,
                Section::Maybe => &mut parsed.maybe,
            };
            for _ in 0..qty {
                bucket.push(name.clone());
            }
        }
    }
    parsed
}

async fn build_deck_json(
    pool: &SqlitePool,
    parsed: &ParsedDeck,
    commander_name: &str,
) -> anyhow::Result<(
    serde_json::Value,
    serde_json::Value,
    serde_json::Value,
    Option<serde_json::Value>,
)> {
    // Resolve every referenced name in one DB round-trip.
    let unique: Vec<String> = {
        let mut seen = std::collections::HashSet::new();
        parsed
            .main
            .iter()
            .chain(parsed.side.iter())
            .chain(parsed.maybe.iter())
            .filter(|n| seen.insert((*n).clone()))
            .cloned()
            .collect()
    };
    let found = db::cards::find_by_names(pool, &unique).await?;
    let card_map: std::collections::HashMap<String, _> =
        found.into_iter().map(|c| (c.name.to_lowercase(), c)).collect();

    let mut commander_json: Option<serde_json::Value> = None;
    let resolve = |names: &[String],
                   commander_json: &mut Option<serde_json::Value>|
     -> anyhow::Result<serde_json::Value> {
        let mut out = Vec::new();
        for name in names {
            if let Some(card) = card_map.get(&name.to_lowercase()) {
                let val = serde_json::to_value(card)?;
                if !commander_name.is_empty()
                    && name.to_lowercase() == commander_name.to_lowercase()
                {
                    *commander_json = Some(val.clone());
                }
                out.push(val);
            }
        }
        Ok(serde_json::Value::Array(out))
    };

    let cards_json = resolve(&parsed.main, &mut commander_json)?;
    let side_json = resolve(&parsed.side, &mut commander_json)?;
    let maybe_json = resolve(&parsed.maybe, &mut commander_json)?;
    Ok((cards_json, side_json, maybe_json, commander_json))
}
