use anyhow::{Context, Result};
use dotenvy::dotenv;
use std::env;
use tcg_backend::db::create_pool;
use tcg_backend::upgrades::enrich::refresh_edhrec;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../database/mtg_card_db.db".to_string());

    // Cache window in hours — skip commanders refreshed more recently.
    let cache_hours: i64 = env::var("EDHREC_CACHE_HOURS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(24);

    let pool = create_pool(&database_url).await.context("connect to database")?;
    let refreshed = refresh_edhrec(&pool, cache_hours)
        .await
        .context("refresh_edhrec")?;
    println!("Done — {refreshed} commanders refreshed.");
    Ok(())
}
