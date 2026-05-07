use crate::db::riftbound as db;
use crate::models::riftbound::RbCard;
use axum::{
    extract::{Path, Query, State},
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
        .route("/rb/cards", get(list_cards).post(create_card))
        .route(
            "/rb/cards/:id",
            get(get_card).put(update_card).delete(delete_card),
        )
        .with_state(pool)
}

#[derive(Deserialize)]
struct CardQuery {
    name: Option<String>,
    faction: Option<String>,
    rarity: Option<String>,
    #[serde(rename = "type")]
    card_type: Option<String>,
    set: Option<String>,
}

async fn list_cards(
    State(pool): State<SqlitePool>,
    Query(q): Query<CardQuery>,
) -> impl IntoResponse {
    match db::find_all_cards(
        &pool,
        q.set.as_deref(),
        q.faction.as_deref(),
        q.card_type.as_deref(),
        q.rarity.as_deref(),
        q.name.as_deref(),
    )
    .await
    {
        Ok(cards) => Json(cards).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn get_card(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match db::find_card_by_id(&pool, &id).await {
        Ok(Some(card)) => Json(card).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Card not found"})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn create_card(
    State(pool): State<SqlitePool>,
    Json(card): Json<RbCard>,
) -> impl IntoResponse {
    match db::upsert_card(&pool, &card).await {
        Ok(_) => (StatusCode::CREATED, Json(card)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn update_card(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
    Json(mut card): Json<RbCard>,
) -> impl IntoResponse {
    card.id = id;
    match db::upsert_card(&pool, &card).await {
        Ok(_) => Json(card).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}

async fn delete_card(
    State(pool): State<SqlitePool>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match db::delete_card(&pool, &id).await {
        Ok(1..) => Json(json!({"message": "Card deleted"})).into_response(),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Card not found"})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        )
            .into_response(),
    }
}
