use crate::db;
use crate::models::Card;
use crate::routes::require_auth;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
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
    #[serde(rename = "type")]
    card_type: Option<String>,
    color: Option<String>,
}

async fn list_cards(
    State(pool): State<SqlitePool>,
    Query(params): Query<CardQuery>,
) -> impl IntoResponse {
    let has_filters = params.card_type.is_some() || params.color.is_some();

    // When type or color filters are present, use the filter query
    if has_filters || params.name.as_deref().map(|n| !n.contains(';')).unwrap_or(false) && params.name.is_some() {
        if !has_filters && params.name.as_deref().unwrap_or("").trim().is_empty() {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Name parameter is empty"}))).into_response();
        }
        return match db::cards::find_with_filters(
            &pool,
            params.name.as_deref(),
            params.card_type.as_deref(),
            params.color.as_deref(),
        )
        .await
        {
            Ok(cards) => Json(cards).into_response(),
            Err(e) => {
                tracing::error!("list_cards filter error: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
            }
        };
    }

    // Semicolon-separated multi-card lookup (used by deck builder)
    match &params.name {
        Some(name) if name.trim().is_empty() => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Name parameter is empty"}))).into_response()
        }
        Some(name) => {
            let names: Vec<String> = name.split(';').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            match db::cards::find_by_names(&pool, &names).await {
                Ok(cards) => Json(cards).into_response(),
                Err(e) => {
                    tracing::error!("list_cards names error: {e}");
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
                }
            }
        }
        None => match db::cards::find_all(&pool).await {
            Ok(cards) => Json(cards).into_response(),
            Err(e) => {
                tracing::error!("list_cards all error: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
            }
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
        Err(e) => {
            tracing::error!("get_card error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

async fn create_card(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(card): Json<Card>,
) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }
    match db::cards::insert(&pool, &card).await {
        Ok(_) => (StatusCode::CREATED, Json(card)).into_response(),
        Err(e) => {
            tracing::error!("create_card error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

async fn update_card(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Path(name): Path<String>,
    Json(card): Json<Card>,
) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }
    match db::cards::update(&pool, &name, &card).await {
        Ok(true) => Json(card).into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Card not found"}))).into_response(),
        Err(e) => {
            tracing::error!("update_card error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

async fn delete_card(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }
    match db::cards::delete(&pool, &name).await {
        Ok(true) => Json(serde_json::json!({"message": "Card deleted successfully"})).into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Card not found"}))).into_response(),
        Err(e) => {
            tracing::error!("delete_card error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}
