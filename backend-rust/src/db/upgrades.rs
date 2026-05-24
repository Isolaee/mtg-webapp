// DB layer for the upgrade-proposal feature. Owns the edhrec_commander_cards
// table and column migrations on the existing `cards` table (price_usd, otags).
// `cards.legalities` already exists — we just refresh it from Scryfall.

use sqlx::SqlitePool;

pub async fn ensure_tables(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS edhrec_commander_cards (
            commander_slug TEXT NOT NULL,
            card_name      TEXT NOT NULL,
            inclusion_pct  REAL,
            synergy_lift   REAL,
            updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (commander_slug, card_name)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_ecc_commander
         ON edhrec_commander_cards(commander_slug)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_ecc_card
         ON edhrec_commander_cards(card_name)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Add price_usd + otags columns to the existing `cards` table. Idempotent —
/// ignores "duplicate column" errors when the columns already exist.
pub async fn migrate_columns(pool: &SqlitePool) -> anyhow::Result<()> {
    let _ = sqlx::query("ALTER TABLE cards ADD COLUMN price_usd REAL")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE cards ADD COLUMN otags TEXT")
        .execute(pool)
        .await;
    Ok(())
}

/// Update one card's enrichment fields. Matched by case-insensitive name.
/// Returns the number of rows changed (0 if the card isn't in our local DB).
pub async fn upsert_card_enrichment(
    pool: &SqlitePool,
    name: &str,
    price_usd: Option<f64>,
    legalities_json: &str,
) -> anyhow::Result<u64> {
    let result = sqlx::query(
        "UPDATE cards SET price_usd = ?, legalities = ?
         WHERE LOWER(name) = LOWER(?)",
    )
    .bind(price_usd)
    .bind(legalities_json)
    .bind(name)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Distinct, non-null commander names across all user decks. Used as the
/// seed list for EDHREC enrichment.
pub async fn list_distinct_commanders(pool: &SqlitePool) -> anyhow::Result<Vec<String>> {
    let rows = sqlx::query_as::<_, (String,)>(
        "SELECT DISTINCT CAST(commander AS TEXT) as commander
         FROM decks
         WHERE commander IS NOT NULL AND TRIM(commander) != ''",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|(n,)| n).collect())
}

/// Has this commander been refreshed within the last `hours`? Used by the
/// EDHREC fetcher to honor a 24h cache and skip recent commanders.
pub async fn edhrec_slug_fresh(
    pool: &SqlitePool,
    slug: &str,
    hours: i64,
) -> anyhow::Result<bool> {
    let row = sqlx::query_as::<_, (Option<String>,)>(
        "SELECT MAX(updated_at) FROM edhrec_commander_cards WHERE commander_slug = ?",
    )
    .bind(slug)
    .fetch_one(pool)
    .await?;
    let Some(ts) = row.0 else {
        return Ok(false);
    };
    let row2 = sqlx::query_as::<_, (i64,)>(
        "SELECT (julianday('now') - julianday(?)) * 24 < ?",
    )
    .bind(ts)
    .bind(hours)
    .fetch_one(pool)
    .await?;
    Ok(row2.0 != 0)
}

/// Bulk-insert EDHREC entries for one commander. Replaces existing rows for
/// that commander first (so cards that fell out of the top list are removed).
pub async fn replace_edhrec_for_commander(
    pool: &SqlitePool,
    slug: &str,
    entries: &[(String, Option<f64>, Option<f64>)], // (card_name, inclusion_pct, synergy_lift)
) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;
    sqlx::query("DELETE FROM edhrec_commander_cards WHERE commander_slug = ?")
        .bind(slug)
        .execute(&mut *tx)
        .await?;
    for (card_name, inclusion_pct, synergy_lift) in entries {
        sqlx::query(
            "INSERT INTO edhrec_commander_cards
                (commander_slug, card_name, inclusion_pct, synergy_lift, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'))",
        )
        .bind(slug)
        .bind(card_name)
        .bind(inclusion_pct)
        .bind(synergy_lift)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}
