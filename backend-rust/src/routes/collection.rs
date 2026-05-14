use crate::db;
use crate::phash::phash;
use crate::routes::require_auth;
use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, Query, State},
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
        .route("/collection/scan", axum::routing::post(scan_card).layer(DefaultBodyLimit::max(5 * 1024 * 1024)))
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
            tracing::error!("list_collection db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
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
            tracing::error!("add_to_collection db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
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
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"msg": "Entry not found"}))).into_response(),
        Err(e) => {
            tracing::error!("update_entry db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
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
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"msg": "Entry not found"}))).into_response(),
        Err(e) => {
            tracing::error!("remove_entry db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

// ── Card scanning ─────────────────────────────────────────────────────────────

async fn scan_card(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if let Err(r) = require_auth(&headers) {
        return r;
    }

    // Read image bytes from the "image" multipart field
    let mut image_bytes: Option<Vec<u8>> = None;
    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name().unwrap_or("") == "image" {
            match field.bytes().await {
                Ok(b) => image_bytes = Some(b.to_vec()),
                Err(e) => {
                    return (StatusCode::BAD_REQUEST, Json(json!({"msg": e.to_string()})))
                        .into_response()
                }
            }
            break;
        }
    }

    let bytes = match image_bytes {
        Some(b) if !b.is_empty() => b,
        _ => {
            return (StatusCode::BAD_REQUEST, Json(json!({"msg": "No image field in request"})))
                .into_response()
        }
    };

    // Decode and hash the uploaded image
    let query_hash = match compute_phash_from_bytes(&bytes) {
        Ok(h) => h,
        Err(e) => {
            return (StatusCode::BAD_REQUEST, Json(json!({"msg": format!("Image decode error: {e}")})))
                .into_response()
        }
    };

    // Load all stored hashes and find the closest matches
    let all_hashes = match db::collection::find_all_hashes(&pool).await {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("scan_card hash lookup error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
        }
    };

    if all_hashes.is_empty() {
        return Json(json!({"matches": [], "note": "No card hashes in DB — run hash_cards binary first"}))
            .into_response();
    }

    // Sort by Hamming distance and take top 3
    let mut scored: Vec<_> = all_hashes
        .iter()
        .map(|row| (hamming(query_hash, row.phash), &row.game, &row.card_id))
        .collect();
    scored.sort_by_key(|(dist, _, _)| *dist);
    let top3 = &scored[..scored.len().min(3)];

    // Enrich matches with card name and image from the respective tables
    let mut matches = Vec::with_capacity(3);
    for (distance, game, card_id) in top3 {
        let (name, image) = enrich_card(&pool, game, card_id).await;
        matches.push(json!({
            "game": game,
            "card_id": card_id,
            "card_name": name,
            "image": image,
            "distance": distance,
        }));
    }

    Json(json!({"matches": matches})).into_response()
}

async fn enrich_card(pool: &SqlitePool, game: &str, card_id: &str) -> (String, Option<String>) {
    if game == "mtg" {
        let row = sqlx::query_as::<_, (String, Option<String>)>(
            "SELECT name, image FROM cards WHERE LOWER(name) = LOWER(?)",
        )
        .bind(card_id)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);
        row.unwrap_or_else(|| (card_id.to_string(), None))
    } else {
        let row = sqlx::query_as::<_, (String, Option<String>)>(
            "SELECT name, image FROM rb_cards WHERE id = ?",
        )
        .bind(card_id)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);
        row.map(|(name, img)| (name, img))
            .unwrap_or_else(|| (card_id.to_string(), None))
    }
}

// ── pHash helpers ─────────────────────────────────────────────────────────────

fn compute_phash_from_bytes(bytes: &[u8]) -> anyhow::Result<i64> {
    let img = image::load_from_memory(bytes)?;
    Ok(phash(&img))
}

fn hamming(a: i64, b: i64) -> u32 {
    (a ^ b).count_ones()
}
