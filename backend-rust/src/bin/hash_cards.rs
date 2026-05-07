use anyhow::{Context, Result};
use dotenvy::dotenv;
use std::env;
use std::sync::Arc;
use tcg_backend::db;
use tcg_backend::phash::phash;
use tokio::sync::Semaphore;

const CONCURRENCY: usize = 20;

struct CardJob {
    game: &'static str,
    card_id: String,
    image_url: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../database/mtg_card_db.db".to_string());

    println!("Connecting to {database_url}");
    let pool = Arc::new(db::create_pool(&database_url).await.context("create_pool")?);

    let jobs = collect_jobs(&pool).await?;
    let total = jobs.len();

    if total == 0 {
        println!("All cards already hashed — nothing to do.");
        return Ok(());
    }
    println!("Hashing {total} cards ({CONCURRENCY} concurrent)...");

    let client = Arc::new(
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?,
    );
    let sem = Arc::new(Semaphore::new(CONCURRENCY));
    let mut set = tokio::task::JoinSet::new();

    for job in jobs {
        let pool = pool.clone();
        let client = client.clone();
        let permit = sem.clone().acquire_owned().await.unwrap();
        set.spawn(async move {
            let _permit = permit;
            hash_one(&pool, &client, job).await
        });
    }

    let mut done = 0u32;
    let mut errors = 0u32;
    while let Some(res) = set.join_next().await {
        match res.unwrap() {
            Ok(()) => done += 1,
            Err(e) => {
                errors += 1;
                eprintln!("  warn: {e}");
            }
        }
        let completed = done + errors;
        if completed % 500 == 0 {
            println!("  {completed}/{total} ({errors} errors)");
        }
    }

    println!("Done — {done} hashed, {errors} skipped/errored.");
    Ok(())
}

async fn collect_jobs(pool: &sqlx::SqlitePool) -> Result<Vec<CardJob>> {
    // MTG cards with images not yet in card_hashes
    let mtg: Vec<(String, String)> = sqlx::query_as(
        "SELECT c.name, c.image FROM cards c
         WHERE c.image IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM card_hashes h
               WHERE h.game = 'mtg' AND h.card_id = c.name
           )",
    )
    .fetch_all(pool)
    .await
    .context("query MTG cards")?;

    // Riftbound cards — prefer image_small to reduce download size
    let rb: Vec<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT r.id, r.image_small, r.image FROM rb_cards r
         WHERE (r.image_small IS NOT NULL OR r.image IS NOT NULL)
           AND NOT EXISTS (
               SELECT 1 FROM card_hashes h
               WHERE h.game = 'riftbound' AND h.card_id = r.id
           )",
    )
    .fetch_all(pool)
    .await
    .context("query Riftbound cards")?;

    let mut jobs: Vec<CardJob> = Vec::with_capacity(mtg.len() + rb.len());
    for (name, url) in mtg {
        jobs.push(CardJob { game: "mtg", card_id: name, image_url: url });
    }
    for (id, small, full) in rb {
        if let Some(url) = small.or(full) {
            jobs.push(CardJob { game: "riftbound", card_id: id, image_url: url });
        }
    }

    println!(
        "  {} MTG + {} Riftbound cards need hashing",
        jobs.iter().filter(|j| j.game == "mtg").count(),
        jobs.iter().filter(|j| j.game == "riftbound").count(),
    );
    Ok(jobs)
}

async fn hash_one(
    pool: &sqlx::SqlitePool,
    client: &reqwest::Client,
    job: CardJob,
) -> Result<()> {
    let bytes = client
        .get(&job.image_url)
        .send()
        .await
        .with_context(|| format!("GET {}", job.image_url))?
        .error_for_status()
        .with_context(|| format!("HTTP error for {}", job.card_id))?
        .bytes()
        .await
        .with_context(|| format!("read bytes for {}", job.card_id))?;

    let img = image::load_from_memory(&bytes)
        .with_context(|| format!("decode image for {}", job.card_id))?;
    let hash = phash(&img);

    sqlx::query(
        "INSERT INTO card_hashes (game, card_id, phash)
         VALUES (?, ?, ?)
         ON CONFLICT(game, card_id) DO NOTHING",
    )
    .bind(job.game)
    .bind(&job.card_id)
    .bind(hash)
    .execute(pool)
    .await
    .with_context(|| format!("upsert hash for {}", job.card_id))?;

    Ok(())
}
