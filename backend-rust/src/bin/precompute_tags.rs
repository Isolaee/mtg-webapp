use anyhow::{Context, Result};
use dotenvy::dotenv;
use std::env;
use tcg_backend::analysis;
use tcg_backend::db::{
    self,
    analysis::{load_all_card_names_and_oracle, load_all_rb_card_ids_and_data, upsert_tags},
};

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

    let pool = db::create_pool(&database_url).await.context("connect to database")?;

    let mtg = load_all_card_names_and_oracle(&pool).await.context("load MTG cards")?;
    let mut mtg_done = 0u32;
    for (name, card_json) in &mtg {
        let tags = analysis::extract_tags_for_card(card_json, "mtg");
        if let Err(e) = upsert_tags(&pool, name, &tags).await {
            tracing::warn!("upsert tags failed for {name}: {e}");
        } else {
            mtg_done += 1;
        }
        if mtg_done % 5000 == 0 {
            tracing::info!("mtg: {mtg_done}/{}", mtg.len());
        }
    }
    tracing::info!("mtg: done — {mtg_done} cards tagged");

    let rb = load_all_rb_card_ids_and_data(&pool).await.context("load Riftbound cards")?;
    let mut rb_done = 0u32;
    for (id, card_json) in &rb {
        let tags = analysis::extract_tags_for_card(card_json, "riftbound");
        if let Err(e) = upsert_tags(&pool, id, &tags).await {
            tracing::warn!("upsert tags failed for {id}: {e}");
        } else {
            rb_done += 1;
        }
    }
    tracing::info!("riftbound: done — {rb_done} cards tagged");

    println!("Done — MTG: {mtg_done}, Riftbound: {rb_done}");
    Ok(())
}
