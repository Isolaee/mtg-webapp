use tcg_backend::{db, routes};

use axum::Router;
use dotenvy::dotenv;
use std::env;
use axum::http::HeaderValue;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            env::var("RUST_LOG").unwrap_or_else(|_| "tcg_backend=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../database/mtg_card_db.db".to_string());

    let pool = db::create_pool(&database_url).await?;

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse::<HeaderValue>().unwrap(),
            "capacitor://localhost".parse::<HeaderValue>().unwrap(),
            "https://localhost".parse::<HeaderValue>().unwrap(),
        ])
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/health", axum::routing::get(|| async { "ok" }))
        .nest("/api", routes::router(pool))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = "0.0.0.0:8080";
    tracing::info!("listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
