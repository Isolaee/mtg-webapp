// Admin-gated upgrade-feature endpoints. v1 exposes only the two enrichment
// triggers; the per-deck POST /api/upgrades will land with tcg-website-2os.

use axum::{
    extract::State,
    http::HeaderMap,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde_json::json;
use sqlx::SqlitePool;

use crate::routes::{require_admin, require_auth};
use crate::upgrades::enrich::{refresh_edhrec, refresh_scryfall};

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/upgrades/refresh-scryfall", post(handle_refresh_scryfall))
        .route("/upgrades/refresh-edhrec", post(handle_refresh_edhrec))
        .with_state(pool)
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
