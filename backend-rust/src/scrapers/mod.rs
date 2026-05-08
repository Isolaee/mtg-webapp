pub mod mtgo;
pub mod riftdecks;

use crate::db;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Serialize, Deserialize)]
pub struct DeckEntry {
    pub name: String,
    pub qty: i32,
    pub card_type: String,
}

pub struct ScrapedPlacement {
    pub placement: Option<i32>,
    pub player: Option<String>,
    pub record: Option<String>,
    pub decklist: Vec<DeckEntry>,
}

pub struct ScrapedEvent {
    pub source: String,
    pub external_id: String,
    pub name: String,
    pub game: String,
    pub format: Option<String>,
    pub event_date: Option<String>,
    pub placements: Vec<ScrapedPlacement>,
}

pub async fn run_all_scrapers(
    client: &reqwest::Client,
    pool: &SqlitePool,
) -> anyhow::Result<()> {
    let scraped_at = Utc::now().to_rfc3339();

    // Run MTGO and riftdecks in parallel — each persists incrementally.
    let mtgo_fut = mtgo::scrape(client, pool, &scraped_at);
    let rd_fut = riftdecks::scrape(pool, &scraped_at);
    let (mtgo_res, rd_res) = tokio::join!(mtgo_fut, rd_fut);

    if let Err(e) = mtgo_res {
        tracing::error!("MTGO scrape failed: {e}");
    }
    if let Err(e) = rd_res {
        tracing::error!("riftdecks scrape failed: {e}");
    }

    Ok(())
}

pub(super) async fn persist_events(
    pool: &SqlitePool,
    events: Vec<ScrapedEvent>,
    scraped_at: &str,
) -> anyhow::Result<()> {
    for event in events {
        let event_id = db::tournaments::upsert_event(
            pool,
            &event.source,
            &event.external_id,
            &event.name,
            &event.game,
            event.format.as_deref(),
            event.event_date.as_deref(),
            scraped_at,
        )
        .await?;

        let Some(event_id) = event_id else {
            // Already exists — skip placements to avoid duplicates
            continue;
        };

        for p in event.placements {
            let decklist_json = if p.decklist.is_empty() {
                None
            } else {
                Some(serde_json::to_string(&p.decklist)?)
            };

            db::tournaments::insert_placement(
                pool,
                event_id,
                p.placement.map(|v| v as i64),
                p.player.as_deref(),
                p.record.as_deref(),
                decklist_json.as_deref(),
            )
            .await?;
        }
    }

    Ok(())
}
