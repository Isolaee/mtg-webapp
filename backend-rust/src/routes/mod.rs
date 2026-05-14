pub mod analysis;
pub mod auth;
pub mod cards;
pub mod collection;
pub mod decks;
pub mod riftbound;
pub mod tournaments;

use axum::{
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json, Router,
};
use sqlx::SqlitePool;

pub(crate) fn require_auth(headers: &HeaderMap) -> Result<String, axum::response::Response> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    auth::extract_username(token)
        .map_err(|_| (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Unauthorized"}))).into_response())
}

pub(crate) fn require_admin(headers: &HeaderMap) -> Result<(), axum::response::Response> {
    let secret = std::env::var("ADMIN_SECRET").unwrap_or_default();
    if secret.is_empty() {
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({"msg": "Forbidden"}))).into_response());
    }
    let provided = headers
        .get("x-admin-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided == secret {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, Json(serde_json::json!({"msg": "Forbidden"}))).into_response())
    }
}

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .merge(cards::router(pool.clone()))
        .merge(decks::router(pool.clone()))
        .merge(auth::router(pool.clone()))
        .merge(riftbound::router(pool.clone()))
        .merge(collection::router(pool.clone()))
        .merge(analysis::router(pool.clone()))
        .merge(tournaments::router(pool))
}
