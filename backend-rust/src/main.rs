use tcg_backend::{db, routes, scrapers};

use axum::Router;
use dotenvy::dotenv;
use std::{env, net::SocketAddr, time::Duration};
use axum::http::{HeaderValue, Method};
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

    let scrape_pool = pool.clone();
    tokio::spawn(async move {
        let client = reqwest::Client::builder()
            .user_agent(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 \
                 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            )
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();
        loop {
            if let Err(e) = scrapers::run_all_scrapers(&client, &scrape_pool).await {
                tracing::error!("scrape error: {e}");
            }
            tokio::time::sleep(Duration::from_secs(6 * 3600)).await;
        }
    });

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse::<HeaderValue>().unwrap(),
            "capacitor://localhost".parse::<HeaderValue>().unwrap(),
            "https://localhost".parse::<HeaderValue>().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([axum::http::header::AUTHORIZATION, axum::http::header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/health", axum::routing::get(|| async { "ok" }))
        .nest("/api", routes::router(pool))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = "0.0.0.0:8080";
    tracing::info!("listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;

    Ok(())
}
