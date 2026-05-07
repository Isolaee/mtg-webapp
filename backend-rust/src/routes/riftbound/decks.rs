use crate::db::riftbound as db;
use crate::models::riftbound::RbDeck;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/rb/decks", get(list_decks).post(save_deck))
        .route("/rb/decks/:name", get(get_deck).delete(delete_deck))
        .with_state(pool)
}

#[derive(Deserialize)]
struct DeckInput {
    name: String,
    #[serde(default = "default_format")]
    format: String,
    champion: Option<String>,
    main_deck: Option<serde_json::Value>,
    rune_deck: Option<serde_json::Value>,
    battlefields: Option<serde_json::Value>,
    description: Option<String>,
}

fn default_format() -> String {
    "standard".to_string()
}

fn input_to_model(input: DeckInput) -> RbDeck {
    RbDeck {
        id: 0,
        name: input.name,
        format: input.format,
        champion: input.champion,
        main_deck: input
            .main_deck
            .map(|v| serde_json::to_string(&v).unwrap_or_default()),
        rune_deck: input
            .rune_deck
            .map(|v| serde_json::to_string(&v).unwrap_or_default()),
        battlefields: input
            .battlefields
            .map(|v| serde_json::to_string(&v).unwrap_or_default()),
        description: input.description,
        created_at: None,
    }
}

fn deck_to_json(deck: &RbDeck) -> serde_json::Value {
    json!({
        "id": deck.id,
        "name": deck.name,
        "format": deck.format,
        "champion": deck.champion,
        "main_deck": parse_json_field(&deck.main_deck),
        "rune_deck": parse_json_field(&deck.rune_deck),
        "battlefields": parse_json_field(&deck.battlefields),
        "description": deck.description,
        "created_at": deck.created_at,
    })
}

fn parse_json_field(s: &Option<String>) -> serde_json::Value {
    s.as_deref()
        .and_then(|v| serde_json::from_str(v).ok())
        .unwrap_or(json!([]))
}

async fn list_decks(State(pool): State<SqlitePool>) -> impl IntoResponse {
    match db::find_all_decks(&pool).await {
        Ok(decks) => {
            let out: Vec<_> = decks
                .iter()
                .map(|d| json!({"id": d.id, "name": d.name, "format": d.format, "description": d.description}))
                .collect();
            Json(json!({"decks": out})).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn get_deck(
    State(pool): State<SqlitePool>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match db::find_deck_by_name(&pool, &name).await {
        Ok(Some(deck)) => Json(deck_to_json(&deck)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Deck not found"})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn save_deck(
    State(pool): State<SqlitePool>,
    Json(input): Json<DeckInput>,
) -> impl IntoResponse {
    let deck = input_to_model(input);
    match db::save_deck(&pool, &deck).await {
        Ok(_) => (StatusCode::CREATED, Json(json!({"message": "Deck saved"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn delete_deck(
    State(pool): State<SqlitePool>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match db::delete_deck(&pool, &name).await {
        Ok(1..) => Json(json!({"message": "Deck deleted"})).into_response(),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Deck not found"})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}
