// Card-duel HTTP endpoints ("which card is stronger?"), namespaced under
// /api/minigames/duel/* so they sit within the minigames surface without
// colliding with the static-poll routes (/api/minigames/:id is Path<i64>,
// a single segment — the duel paths carry an extra segment).
//
//   GET  /api/minigames/duel/pair?game=&format=        — two random eligible cards + ELOs
//   POST /api/minigames/duel/vote                        — record a vote, update ELO (rate-limited)
//   GET  /api/minigames/duel/leaderboard?game=&format=&limit=  — top-N by ELO

use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;

use crate::db;
use crate::rate_limit::{rate_limit_middleware, RateLimiter};
use crate::routes::auth;

const MTG_FORMATS: &[&str] = &[
    "commander", "standard", "modern", "pioneer", "legacy", "vintage", "pauper", "brawl",
    "historic", "alchemy",
];

pub fn router(pool: SqlitePool) -> Router {
    let vote_limiter = RateLimiter::new(30, 60); // 30 votes / 60s per IP

    let vote_route = Router::new()
        .route("/minigames/duel/vote", post(vote))
        .route_layer(axum::middleware::from_fn_with_state(
            vote_limiter,
            rate_limit_middleware,
        ))
        .with_state(pool.clone());

    Router::new()
        .route("/minigames/duel/pair", get(pair))
        .route("/minigames/duel/leaderboard", get(leaderboard))
        .with_state(pool)
        .merge(vote_route)
}

/// Validates and normalizes (game, format). MTG must be one of the known
/// formats; Riftbound is always the single "all" pool.
fn validate_scope(game: &str, format: &str) -> Result<(String, String), Response> {
    let fmt = format.to_lowercase();
    let ok = match game {
        "mtg" => MTG_FORMATS.contains(&fmt.as_str()),
        "riftbound" => fmt == "all",
        _ => false,
    };
    if ok {
        Ok((game.to_string(), fmt))
    } else {
        Err((StatusCode::BAD_REQUEST, Json(json!({"msg": "Invalid game or format"}))).into_response())
    }
}

#[derive(Deserialize)]
struct ScopeQuery {
    game: String,
    format: String,
}

#[derive(Serialize)]
struct PairResponse {
    game: String,
    format: String,
    cards: Vec<db::card_duel::DuelCardRow>,
}

async fn pair(State(pool): State<SqlitePool>, Query(q): Query<ScopeQuery>) -> impl IntoResponse {
    let (game, fmt) = match validate_scope(&q.game, &q.format) {
        Ok(s) => s,
        Err(r) => return r,
    };

    let result = match game.as_str() {
        "mtg" => db::card_duel::pick_mtg_pair(&pool, &fmt).await,
        _ => db::card_duel::pick_rb_pair(&pool).await,
    };

    match result {
        Ok(Some((a, b))) => Json(PairResponse { game, format: fmt, cards: vec![a, b] }).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"msg": "Not enough eligible cards for this game/format"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("duel pair db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct VoteRequest {
    game: String,
    format: String,
    winner_card_id: String,
    loser_card_id: String,
    #[serde(default)]
    voter_key: Option<String>,
}

#[derive(Serialize)]
struct RatingChange {
    old: f64,
    new: f64,
}

#[derive(Serialize)]
struct VoteResponse {
    winner_card_id: String,
    loser_card_id: String,
    winner: RatingChange,
    loser: RatingChange,
    higher_card_id: String,
}

async fn vote(
    State(pool): State<SqlitePool>,
    headers: HeaderMap,
    Json(body): Json<VoteRequest>,
) -> impl IntoResponse {
    let (game, fmt) = match validate_scope(&body.game, &body.format) {
        Ok(s) => s,
        Err(r) => return r,
    };

    if body.winner_card_id == body.loser_card_id {
        return (StatusCode::BAD_REQUEST, Json(json!({"msg": "winner and loser must differ"}))).into_response();
    }

    // Re-validate both ids exist & are eligible — the body is attacker-controlled.
    for id in [&body.winner_card_id, &body.loser_card_id] {
        match db::card_duel::card_eligible(&pool, &game, &fmt, id).await {
            Ok(true) => {}
            Ok(false) => {
                return (StatusCode::BAD_REQUEST, Json(json!({"msg": "Unknown or ineligible card"}))).into_response();
            }
            Err(e) => {
                tracing::error!("duel card_eligible db error: {e}");
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
            }
        }
    }

    // Optional auth — authed users are attributed by username, else by client voter_key.
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

    let outcome = match db::card_duel::apply_vote(&pool, &game, &fmt, &body.winner_card_id, &body.loser_card_id).await {
        Ok(o) => o,
        Err(e) => {
            tracing::error!("duel apply_vote db error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response();
        }
    };

    if let Err(e) = db::card_duel::record_vote(
        &pool,
        &game,
        &fmt,
        &body.winner_card_id,
        &body.loser_card_id,
        &voter_key,
        user_id.as_deref(),
    )
    .await
    {
        // Audit failure shouldn't fail the user-visible result; log and continue.
        tracing::error!("duel record_vote db error: {e}");
    }

    let higher_card_id = if outcome.winner_new >= outcome.loser_new {
        body.winner_card_id.clone()
    } else {
        body.loser_card_id.clone()
    };

    Json(VoteResponse {
        winner_card_id: body.winner_card_id,
        loser_card_id: body.loser_card_id,
        winner: RatingChange { old: outcome.winner_old, new: outcome.winner_new },
        loser: RatingChange { old: outcome.loser_old, new: outcome.loser_new },
        higher_card_id,
    })
    .into_response()
}

#[derive(Deserialize)]
struct LeaderboardQuery {
    game: String,
    format: String,
    limit: Option<i64>,
}

#[derive(Serialize)]
struct LeaderboardEntry {
    rank: i64,
    name: String,
    image: Option<String>,
    elo: f64,
    games_played: i64,
    wins: i64,
}

async fn leaderboard(
    State(pool): State<SqlitePool>,
    Query(q): Query<LeaderboardQuery>,
) -> impl IntoResponse {
    let (game, fmt) = match validate_scope(&q.game, &q.format) {
        Ok(s) => s,
        Err(r) => return r,
    };
    let limit = q.limit.unwrap_or(10).clamp(1, 50);

    match db::card_duel::leaderboard(&pool, &game, &fmt, limit).await {
        Ok(rows) => {
            let entries: Vec<LeaderboardEntry> = rows
                .into_iter()
                .enumerate()
                .map(|(i, r)| LeaderboardEntry {
                    rank: i as i64 + 1,
                    name: r.name,
                    image: r.image,
                    elo: r.elo,
                    games_played: r.games_played,
                    wins: r.wins,
                })
                .collect();
            Json(entries).into_response()
        }
        Err(e) => {
            tracing::error!("duel leaderboard db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"msg": "Internal server error"}))).into_response()
        }
    }
}
