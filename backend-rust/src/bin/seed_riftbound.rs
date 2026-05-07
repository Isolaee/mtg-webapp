use anyhow::{Context, Result};
use dotenvy::dotenv;
use serde::Deserialize;
use std::env;
use tcg_backend::db::riftbound::{ensure_tables, upsert_card};
use tcg_backend::models::riftbound::RbCard;

const API_BASE: &str = "https://riftscribe.gg/api/cards";
const SETS: &[&str] = &["OGN", "OGS", "SFD", "UNL", "VEN"];

// ── RiftScribe API response shapes ──────────────────────────────────────────

#[derive(Deserialize)]
struct ApiCard {
    id: String,
    name: String,
    set_id: String,
    collector_number: Option<i64>,
    rarity: String,
    faction: String,
    #[serde(rename = "type")]
    card_type: String,
    orientation: Option<String>,
    stats: Option<ApiStats>,
    image: Option<String>,
    image_thumb: Option<ApiThumb>,
    is_banned: bool,
    description: Option<String>,
    flavor_text: Option<String>,
    art: Option<ApiArt>,
    keywords: Option<Vec<String>>,
    tags: Option<Vec<String>>,
    prev_card_id: Option<String>,
    next_card_id: Option<String>,
}

#[derive(Deserialize)]
struct ApiStats {
    energy: Option<i64>,
    might: Option<i64>,
    power: Option<i64>,
}

#[derive(Deserialize)]
struct ApiThumb {
    small: Option<String>,
    medium: Option<String>,
    large: Option<String>,
}

#[derive(Deserialize)]
struct ApiArt {
    image: Option<String>,
    artist: Option<String>,
}

fn to_model(c: ApiCard) -> RbCard {
    RbCard {
        id: c.id,
        name: c.name,
        set_id: c.set_id,
        collector_number: c.collector_number,
        rarity: c.rarity,
        faction: c.faction,
        card_type: c.card_type,
        orientation: c.orientation,
        energy: c.stats.as_ref().and_then(|s| s.energy),
        might: c.stats.as_ref().and_then(|s| s.might),
        power: c.stats.as_ref().and_then(|s| s.power),
        image: c.image,
        image_small: c.image_thumb.as_ref().and_then(|t| t.small.clone()),
        image_medium: c.image_thumb.as_ref().and_then(|t| t.medium.clone()),
        image_large: c.image_thumb.as_ref().and_then(|t| t.large.clone()),
        art_image: c.art.as_ref().and_then(|a| a.image.clone()),
        art_artist: c.art.as_ref().and_then(|a| a.artist.clone()),
        description: c.description,
        flavor_text: c.flavor_text,
        keywords: c
            .keywords
            .map(|v| serde_json::to_string(&v).unwrap_or_default()),
        tags: c
            .tags
            .map(|v| serde_json::to_string(&v).unwrap_or_default()),
        is_banned: if c.is_banned { 1 } else { 0 },
        prev_card_id: c.prev_card_id,
        next_card_id: c.next_card_id,
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../database/mtg_card_db.db".to_string());

    println!("Connecting to {database_url}");
    let pool = sqlx::SqlitePool::connect(&database_url)
        .await
        .context("connect to database")?;

    ensure_tables(&pool).await.context("ensure_tables")?;

    let client = reqwest::Client::new();
    let mut total = 0usize;

    for set in SETS {
        let url = format!("{API_BASE}?set_id={set}&limit=500");
        let cards: Vec<ApiCard> = client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("fetch {set}"))?
            .json()
            .await
            .with_context(|| format!("parse {set}"))?;

        let count = cards.len();
        println!("  {set}: {count} cards");

        for card in cards {
            upsert_card(&pool, &to_model(card))
                .await
                .with_context(|| format!("upsert {set}"))?;
        }

        total += count;
    }

    println!("Done — {total} cards upserted.");
    Ok(())
}
