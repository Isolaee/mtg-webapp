use anyhow::{Context, Result};
use dotenvy::dotenv;
use std::env;
use tcg_backend::db::create_pool;
use tcg_backend::upgrades::enrich::refresh_scryfall;

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

    let pool = create_pool(&database_url).await.context("connect to database")?;
    let updated = refresh_scryfall(&pool).await.context("refresh_scryfall")?;
    println!("Done — {updated} cards updated.");
    Ok(())
}
