use crate::db;
use axum::{
    extract::{ConnectInfo, State},
    http::{header, StatusCode},
    middleware::Next,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::env;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use uuid::Uuid;

fn jwt_secret() -> String {
    env::var("JWT_SECRET").expect("JWT_SECRET env var must be set")
}

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: String,
    jti: String,
    exp: usize,
}

fn make_token(username: &str) -> anyhow::Result<String> {
    let claims = Claims {
        sub: username.to_string(),
        jti: Uuid::new_v4().to_string(),
        exp: (chrono_now() + 86400) as usize,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_bytes()),
    )?;
    Ok(token)
}

fn chrono_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn extract_claims(auth_header: &str) -> anyhow::Result<Claims> {
    let token = auth_header.strip_prefix("Bearer ").unwrap_or(auth_header);
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

pub fn extract_username(auth_header: &str) -> anyhow::Result<String> {
    Ok(extract_claims(auth_header)?.sub)
}

pub async fn extract_username_checked(
    auth_header: &str,
    pool: &SqlitePool,
) -> anyhow::Result<String> {
    let claims = extract_claims(auth_header)?;
    if db::auth_tokens::is_revoked(pool, &claims.jti).await? {
        anyhow::bail!("token revoked");
    }
    Ok(claims.sub)
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

#[derive(Clone)]
struct RateLimiter {
    map: Arc<Mutex<HashMap<IpAddr, (u32, Instant)>>>,
    max_requests: u32,
    window_secs: u64,
}

impl RateLimiter {
    fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            map: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window_secs,
        }
    }

    fn check_and_increment(&self, ip: IpAddr) -> bool {
        let mut map = self.map.lock().unwrap();
        let now = Instant::now();
        let entry = map.entry(ip).or_insert((0, now));
        if now.duration_since(entry.1).as_secs() >= self.window_secs {
            *entry = (1, now);
            true
        } else if entry.0 < self.max_requests {
            entry.0 += 1;
            true
        } else {
            false
        }
    }
}

async fn rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: axum::extract::Request,
    next: Next,
) -> axum::response::Response {
    if limiter.check_and_increment(addr.ip()) {
        next.run(req).await
    } else {
        (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({"msg": "Too many requests, please try again later"})),
        )
            .into_response()
    }
}

pub fn router(pool: SqlitePool) -> Router {
    let limiter = RateLimiter::new(10, 60);

    let rate_limited = Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route_layer(axum::middleware::from_fn_with_state(
            limiter,
            rate_limit_middleware,
        ))
        .with_state(pool.clone());

    Router::new()
        .route("/whoami", get(whoami))
        .route("/profile", get(profile))
        .route("/change-password", post(change_password))
        .route("/premium/activate", post(activate_premium))
        .route("/logout", post(logout))
        .with_state(pool)
        .merge(rate_limited)
}

// ── Handlers ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct AuthBody {
    username: String,
    password: String,
}

async fn register(
    State(pool): State<SqlitePool>,
    Json(body): Json<AuthBody>,
) -> impl IntoResponse {
    if body.username.is_empty() || body.password.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"msg": "Missing username or password"}))).into_response();
    }
    if body.password.len() < 8 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"msg": "Password must be at least 8 characters"}))).into_response();
    }
    if db::users::find_by_username(&pool, &body.username).await.ok().flatten().is_some() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"msg": "User already exists"}))).into_response();
    }
    let hash = match bcrypt::hash(&body.password, bcrypt::DEFAULT_COST) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("register bcrypt error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response();
        }
    };
    match db::users::insert(&pool, &body.username, &hash).await {
        Ok(_) => (StatusCode::CREATED, Json(serde_json::json!({"msg": "User registered"}))).into_response(),
        Err(e) => {
            tracing::error!("register db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

async fn login(
    State(pool): State<SqlitePool>,
    Json(body): Json<AuthBody>,
) -> impl IntoResponse {
    let user = match db::users::find_by_username(&pool, &body.username).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Bad username or password"}))).into_response(),
    };
    let valid = bcrypt::verify(&body.password, &user.password_hash).unwrap_or(false);
    if !valid {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Bad username or password"}))).into_response();
    }
    match make_token(&user.username) {
        Ok(token) => Json(serde_json::json!({"access_token": token})).into_response(),
        Err(e) => {
            tracing::error!("login token error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

async fn whoami(req: axum::extract::Request) -> impl IntoResponse {
    let auth = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    match extract_username(auth) {
        Ok(username) => Json(serde_json::json!({"username": username})).into_response(),
        Err(_) => (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Invalid or missing token"}))).into_response(),
    }
}

async fn profile(
    State(pool): State<SqlitePool>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let auth = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let username = match extract_username_checked(auth, &pool).await {
        Ok(u) => u,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Unauthorized"}))).into_response(),
    };

    let user = match db::users::find_by_username(&pool, &username).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"msg": "User not found"}))).into_response(),
    };

    let mtg_count = db::users::count_mtg_decks(&pool, &username).await.unwrap_or(0);
    let rb_count = db::users::count_rb_decks(&pool, &username).await.unwrap_or(0);

    Json(serde_json::json!({
        "username": user.username,
        "created_at": user.created_at,
        "mtg_deck_count": mtg_count,
        "rb_deck_count": rb_count,
        "is_premium": user.is_premium.unwrap_or(0) == 1,
    }))
    .into_response()
}

#[derive(Deserialize)]
struct ChangePasswordBody {
    old_password: String,
    new_password: String,
}

async fn change_password(
    State(pool): State<SqlitePool>,
    headers: axum::http::HeaderMap,
    Json(body): Json<ChangePasswordBody>,
) -> impl IntoResponse {
    let auth = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let username = match extract_username_checked(auth, &pool).await {
        Ok(u) => u,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Unauthorized"}))).into_response(),
    };

    if body.new_password.len() < 8 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"msg": "New password must be at least 8 characters"}))).into_response();
    }

    let user = match db::users::find_by_username(&pool, &username).await {
        Ok(Some(u)) => u,
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"msg": "User not found"}))).into_response(),
    };

    if !bcrypt::verify(&body.old_password, &user.password_hash).unwrap_or(false) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Current password is incorrect"}))).into_response();
    }

    let new_hash = match bcrypt::hash(&body.new_password, bcrypt::DEFAULT_COST) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("change_password bcrypt error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response();
        }
    };

    match db::users::update_password(&pool, &username, &new_hash).await {
        Ok(_) => Json(serde_json::json!({"msg": "Password updated"})).into_response(),
        Err(e) => {
            tracing::error!("change_password db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct ActivatePremiumBody {
    purchase_token: Option<String>,
}

async fn activate_premium(
    State(pool): State<SqlitePool>,
    headers: axum::http::HeaderMap,
    Json(body): Json<ActivatePremiumBody>,
) -> impl IntoResponse {
    let auth = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let username = match extract_username_checked(auth, &pool).await {
        Ok(u) => u,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Unauthorized"}))).into_response(),
    };

    let expected = env::var("ACTIVATE_PREMIUM_SECRET").unwrap_or_default();
    if expected.is_empty() {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"msg": "Premium activation not configured"}))).into_response();
    }
    match body.purchase_token.as_deref() {
        Some(t) if t == expected => {}
        _ => return (StatusCode::FORBIDDEN, Json(serde_json::json!({"msg": "Invalid purchase token"}))).into_response(),
    }

    match db::users::set_premium(&pool, &username).await {
        Ok(_) => Json(serde_json::json!({"msg": "Premium activated"})).into_response(),
        Err(e) => {
            tracing::error!("activate_premium db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}

async fn logout(
    State(pool): State<SqlitePool>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    let auth = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let claims = match extract_claims(auth) {
        Ok(c) => c,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"msg": "Unauthorized"}))).into_response(),
    };

    match db::auth_tokens::revoke(&pool, &claims.jti).await {
        Ok(_) => Json(serde_json::json!({"msg": "Logged out"})).into_response(),
        Err(e) => {
            tracing::error!("logout db error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": "Internal server error"}))).into_response()
        }
    }
}
