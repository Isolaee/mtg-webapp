use crate::db;
use crate::routes::require_auth;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;
use std::collections::HashMap;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/collection", get(list_collection).post(add_to_collection))
        .route("/collection/:id", put(update_entry).delete(remove_entry))
        .with_state(pool)
}

async fn list_collection(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let game = params.get("game").map(|s| s.as_str());
    match db::collection::find_all_by_user(&pool, &user, game).await {
        Ok(entries) => Json(json!({"collection": entries})).into_response(),
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct AddInput {
    game: String,
    card_id: String,
    is_foil: Option<bool>,
}

async fn add_to_collection(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(input): Json<AddInput>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let is_foil = input.is_foil.unwrap_or(false);
    match db::collection::upsert(&pool, &user, &input.game, &input.card_id, is_foil).await {
        Ok(id) => (StatusCode::CREATED, Json(json!({"id": id}))).into_response(),
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct UpdateInput {
    quantity: Option<i64>,
    is_foil: Option<bool>,
}

async fn update_entry(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(input): Json<UpdateInput>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    if input.quantity.is_none() && input.is_foil.is_none() {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Nothing to update"}))).into_response();
    }
    match db::collection::update_by_id_and_user(&pool, id, &user, input.quantity, input.is_foil)
        .await
    {
        Ok(1..) => Json(json!({"msg": "Updated"})).into_response(),
        Ok(_) => {
            (StatusCode::NOT_FOUND, Json(json!({"msg": "Entry not found"}))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response()
        }
    }
}

async fn remove_entry(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    let user = match require_auth(&headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    match db::collection::delete_by_id_and_user(&pool, id, &user).await {
        Ok(1..) => Json(json!({"msg": "Deleted"})).into_response(),
        Ok(_) => {
            (StatusCode::NOT_FOUND, Json(json!({"msg": "Entry not found"}))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": e.to_string()}))).into_response()
        }
    }
}
