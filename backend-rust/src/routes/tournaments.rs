use crate::db;
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Deserialize)]
pub struct ListQuery {
    game: Option<String>,
    format: Option<String>,
    limit: Option<i64>,
}

#[derive(Serialize)]
pub struct EventWithPlacements {
    #[serde(flatten)]
    event: crate::models::tournament::TournamentEvent,
    placements: Vec<crate::models::tournament::TournamentPlacement>,
}

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/tournaments", get(list_events))
        .route("/tournaments/:id", get(get_event))
        .with_state(pool)
}

async fn list_events(
    State(pool): State<SqlitePool>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<crate::models::tournament::TournamentEvent>>, axum::http::StatusCode> {
    let limit = q.limit.unwrap_or(50).min(200);
    db::tournaments::list_events(&pool, q.game.as_deref(), q.format.as_deref(), limit)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("list_events error: {e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })
}

async fn get_event(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<Json<EventWithPlacements>, axum::http::StatusCode> {
    let event = db::tournaments::get_event(&pool, id)
        .await
        .map_err(|e| {
            tracing::error!("get_event error: {e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(axum::http::StatusCode::NOT_FOUND)?;

    let placements = db::tournaments::list_placements(&pool, id)
        .await
        .map_err(|e| {
            tracing::error!("list_placements error: {e}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(EventWithPlacements { event, placements }))
}
