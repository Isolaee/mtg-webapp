// Minigames HTTP endpoints — modular, data-driven "select one" community games.
//   GET  /api/minigames           — list active minigames
//   GET  /api/minigames/:id        — minigame + options + current vote aggregate
//   POST /api/minigames/:id/vote   — cast a vote (optional auth; deduped per voter_key)
//   POST /api/minigames            — create a minigame (admin-gated)

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;

use crate::db;
use crate::models::minigame::{Minigame, MinigameOption};
use crate::routes::{auth, require_admin};

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/minigames", get(list_minigames).post(create_minigame))
        .route("/minigames/:id", get(get_minigame))
        .route("/minigames/:id/vote", post(vote))
        .with_state(pool)
}

#[derive(Serialize)]
struct OptionResult {
    option_id: i64,
    label: String,
    card_id: Option<String>,
    image_url: Option<String>,
    position: i64,
    votes: i64,
    percentage: f64,
}

#[derive(Serialize)]
struct MinigameAggregate {
    minigame_id: i64,
    total_votes: i64,
    results: Vec<OptionResult>,
}

#[derive(Serialize)]
struct MinigameDetail {
    #[serde(flatten)]
    minigame: Minigame,
    options: Vec<MinigameOption>,
    aggregate: MinigameAggregate,
}

/// Builds the aggregate (counts + percentages) for a minigame from its options.
async fn build_aggregate(
    pool: &SqlitePool,
    minigame_id: i64,
    options: &[MinigameOption],
) -> anyhow::Result<MinigameAggregate> {
    let counts = db::minigames::aggregate(pool, minigame_id).await?;
    let total: i64 = counts.iter().map(|(_, n)| *n).sum();

    let results = options
        .iter()
        .map(|o| {
            let votes = counts
                .iter()
                .find(|(oid, _)| *oid == o.id)
                .map(|(_, n)| *n)
                .unwrap_or(0);
            let percentage = if total == 0 {
                0.0
            } else {
                (votes as f64 / total as f64 * 1000.0).round() / 10.0
            };
            OptionResult {
                option_id: o.id,
                label: o.label.clone(),
                card_id: o.card_id.clone(),
                image_url: o.image_url.clone(),
                position: o.position,
                votes,
                percentage,
            }
        })
        .collect();

    Ok(MinigameAggregate {
        minigame_id,
        total_votes: total,
        results,
    })
}

async fn list_minigames(State(pool): State<SqlitePool>) -> impl IntoResponse {
    match db::minigames::list_active(&pool).await {
        Ok(games) => Json(games).into_response(),
        Err(e) => {
            tracing::error!("list_minigames db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

async fn get_minigame(State(pool): State<SqlitePool>, Path(id): Path<i64>) -> impl IntoResponse {
    let minigame = match db::minigames::get_minigame(&pool, id).await {
        Ok(Some(m)) => m,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({"msg": "Not found"}))).into_response(),
        Err(e) => {
            tracing::error!("get_minigame db error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
        }
    };

    let options = match db::minigames::get_options(&pool, id).await {
        Ok(o) => o,
        Err(e) => {
            tracing::error!("get_minigame options db error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
        }
    };

    let aggregate = match build_aggregate(&pool, id, &options).await {
        Ok(a) => a,
        Err(e) => {
            tracing::error!("get_minigame aggregate db error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
        }
    };

    Json(MinigameDetail { minigame, options, aggregate }).into_response()
}

#[derive(Deserialize)]
struct VoteRequest {
    option_id: i64,
    #[serde(default)]
    voter_key: Option<String>,
}

async fn vote(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    headers: HeaderMap,
    Json(body): Json<VoteRequest>,
) -> impl IntoResponse {
    // Optional auth — a logged-in user is deduped by username, otherwise by client voter_key.
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let user_id = auth::extract_username(auth_header).ok();

    let voter_key = match &user_id {
        Some(u) => format!("user:{u}"),
        None => match body.voter_key.as_deref().map(str::trim) {
            Some(k) if !k.is_empty() => k.to_string(),
            _ => return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Missing voter_key"}))).into_response(),
        },
    };

    // Validate the option belongs to this minigame before recording.
    match db::minigames::option_belongs(&pool, id, body.option_id).await {
        Ok(true) => {}
        Ok(false) => return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Invalid option for this minigame"}))).into_response(),
        Err(e) => {
            tracing::error!("vote option_belongs db error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
        }
    }

    if let Err(e) = db::minigames::insert_vote(&pool, id, body.option_id, &voter_key, user_id.as_deref()).await {
        tracing::error!("vote insert db error: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
    }

    let options = match db::minigames::get_options(&pool, id).await {
        Ok(o) => o,
        Err(e) => {
            tracing::error!("vote options db error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
        }
    };

    match build_aggregate(&pool, id, &options).await {
        Ok(a) => Json(a).into_response(),
        Err(e) => {
            tracing::error!("vote aggregate db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct CreateOption {
    label: String,
    #[serde(default)]
    card_id: Option<String>,
    #[serde(default)]
    image_url: Option<String>,
    #[serde(default)]
    position: Option<i64>,
}

#[derive(Deserialize)]
struct CreateMinigame {
    #[serde(rename = "type")]
    r#type: String,
    #[serde(default)]
    game: Option<String>,
    prompt: String,
    #[serde(default)]
    status: Option<String>,
    options: Vec<CreateOption>,
}

async fn create_minigame(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(body): Json<CreateMinigame>,
) -> impl IntoResponse {
    if let Err(r) = require_admin(&headers) {
        return r;
    }

    if body.r#type != "select_one" {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Unsupported minigame type"}))).into_response();
    }
    if body.prompt.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Missing prompt"}))).into_response();
    }
    if body.options.len() < 2 {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "At least two options are required"}))).into_response();
    }

    let status = body.status.as_deref().unwrap_or("active").to_string();
    let options: Vec<db::minigames::NewOption> = body
        .options
        .into_iter()
        .enumerate()
        .map(|(i, o)| db::minigames::NewOption {
            label: o.label,
            card_id: o.card_id,
            image_url: o.image_url,
            position: o.position.unwrap_or(i as i64),
        })
        .collect();

    match db::minigames::create_minigame(
        &pool,
        &body.r#type,
        body.game.as_deref(),
        &body.prompt,
        &status,
        &options,
    )
    .await
    {
        Ok(id) => (StatusCode::CREATED, Json(json!({"id": id}))).into_response(),
        Err(e) => {
            tracing::error!("create_minigame db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
    }
}
