use crate::db;
use crate::models::Card;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/cards", get(list_cards).post(create_card))
        .route("/cards/:name", get(get_card).put(update_card).delete(delete_card))
        .with_state(pool)
}

#[derive(Deserialize)]
struct CardQuery {
    name: Option<String>,
}

async fn list_cards(
    State(pool): State<SqlitePool>,
    Query(params): Query<CardQuery>,
) -> impl IntoResponse {
    match &params.name {
        Some(name) if name.trim().is_empty() => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Name parameter is empty"}))).into_response()
        }
        Some(name) => {
            let names: Vec<String> = name.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            match db::cards::find_by_names(&pool, &names).await {
                Ok(cards) => Json(cards).into_response(),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
            }
        }
        None => match db::cards::find_all(&pool).await {
            Ok(cards) => Json(cards).into_response(),
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
        },
    }
}

async fn get_card(
    State(pool): State<SqlitePool>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match db::cards::find_by_name_exact(&pool, &name).await {
        Ok(Some(card)) => Json(card).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Card not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn create_card(
    State(pool): State<SqlitePool>,
    Json(card): Json<Card>,
) -> impl IntoResponse {
    match db::cards::insert(&pool, &card).await {
        Ok(_) => (StatusCode::CREATED, Json(card)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn update_card(
    State(pool): State<SqlitePool>,
    Path(name): Path<String>,
    Json(card): Json<Card>,
) -> impl IntoResponse {
    match db::cards::update(&pool, &name, &card).await {
        Ok(true) => Json(card).into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Card not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn delete_card(
    State(pool): State<SqlitePool>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match db::cards::delete(&pool, &name).await {
        Ok(true) => Json(serde_json::json!({"message": "Card deleted successfully"})).into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Card not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}
