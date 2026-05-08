use super::{persist_events, DeckEntry, ScrapedEvent, ScrapedPlacement};
use serde::Deserialize;
use std::path::PathBuf;

/// Path to the Playwright scraper script (relative to the binary's working directory).
const SCRIPT_PATH: &str = "scripts/scrape_riftdecks.py";

pub async fn scrape(pool: &sqlx::SqlitePool, scraped_at: &str) -> anyhow::Result<()> {
    let script = resolve_script_path()?;

    tracing::info!("riftdecks: launching Playwright scraper at {script:?}");

    let output = tokio::process::Command::new("python3")
        .arg(&script)
        .output()
        .await
        .map_err(|e| anyhow::anyhow!("riftdecks: failed to run python3 scraper: {e}"))?;

    if !output.stderr.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        for line in stderr.lines() {
            if line.starts_with("[error]") {
                tracing::warn!("riftdecks scraper: {line}");
            } else if line.starts_with("[warn]") {
                tracing::debug!("riftdecks scraper: {line}");
            } else {
                tracing::debug!("riftdecks scraper: {line}");
            }
        }
    }

    if !output.status.success() {
        let code = output.status.code().unwrap_or(-1);
        return Err(anyhow::anyhow!("riftdecks scraper exited with code {code}"));
    }

    let json_str = String::from_utf8(output.stdout)
        .map_err(|e| anyhow::anyhow!("riftdecks: scraper output not valid UTF-8: {e}"))?;

    let raw_events: Vec<RawEvent> = serde_json::from_str(&json_str)
        .map_err(|e| anyhow::anyhow!("riftdecks: JSON parse failed: {e}"))?;

    tracing::info!("riftdecks: scraped {} events", raw_events.len());

    let events: Vec<ScrapedEvent> = raw_events.into_iter().map(|r| ScrapedEvent {
        source: r.source,
        external_id: r.external_id,
        name: r.name,
        game: r.game,
        format: r.format,
        event_date: r.event_date,
        placements: r.placements.into_iter().map(|p| ScrapedPlacement {
            placement: p.placement,
            player: p.player,
            record: p.record,
            decklist: p.decklist.into_iter().map(|c| DeckEntry {
                name: c.name,
                qty: c.qty,
                card_type: c.card_type,
            }).collect(),
        }).collect(),
    }).collect();

    persist_events(pool, events, scraped_at).await?;
    Ok(())
}

fn resolve_script_path() -> anyhow::Result<PathBuf> {
    // Try relative to the current working directory first (production: backend-rust/).
    // Then try relative to the binary location.
    let candidates = [
        PathBuf::from(SCRIPT_PATH),
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join(SCRIPT_PATH)))
            .unwrap_or_default(),
        // When running from the repo root
        PathBuf::from("backend-rust").join(SCRIPT_PATH),
    ];

    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    Err(anyhow::anyhow!(
        "riftdecks scraper script not found (looked for {SCRIPT_PATH}). \
         Run the backend from the backend-rust/ directory."
    ))
}

// --- Serde types matching the Python scraper's JSON output ---

#[derive(Deserialize)]
struct RawEvent {
    source: String,
    external_id: String,
    name: String,
    game: String,
    format: Option<String>,
    event_date: Option<String>,
    placements: Vec<RawPlacement>,
}

#[derive(Deserialize)]
struct RawPlacement {
    placement: Option<i32>,
    player: Option<String>,
    record: Option<String>,
    decklist: Vec<RawCard>,
}

#[derive(Deserialize)]
struct RawCard {
    name: String,
    qty: i32,
    card_type: String,
    // Extra fields the Python scraper may include — ignored by DeckEntry
    #[allow(dead_code)]
    deck_url: Option<String>,
    #[allow(dead_code)]
    legend: Option<String>,
}
