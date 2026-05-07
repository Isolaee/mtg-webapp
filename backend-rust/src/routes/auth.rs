use crate::db;
use axum::{
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::env;

fn jwt_secret() -> String {
    env::var("JWT_SECRET").unwrap_or_else(|_| "super-secret-key".to_string())
}

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: usize,
}

fn make_token(username: &str) -> anyhow::Result<String> {
    let claims = Claims {
        sub: username.to_string(),
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

pub fn extract_username(auth_header: &str) -> anyhow::Result<String> {
    let token = auth_header.strip_prefix("Bearer ").unwrap_or(auth_header);
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims.sub)
}

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/whoami", get(whoami))
        .with_state(pool)
}

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
    if db::users::find_by_username(&pool, &body.username).await.ok().flatten().is_some() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"msg": "User already exists"}))).into_response();
    }
    let hash = match bcrypt::hash(&body.password, bcrypt::DEFAULT_COST) {
        Ok(h) => h,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": e.to_string()}))).into_response(),
    };
    match db::users::insert(&pool, &body.username, &hash).await {
        Ok(_) => (StatusCode::CREATED, Json(serde_json::json!({"msg": "User registered"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": e.to_string()}))).into_response(),
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
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"msg": e.to_string()}))).into_response(),
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
