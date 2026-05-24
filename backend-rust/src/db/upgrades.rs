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

/// Lookup EDHREC inclusion percentages for a single commander. Returns an
/// empty map when there's no data for the slug (commander never enriched,
/// or wasn't on EDHREC at all).
pub async fn load_edhrec_inclusion(
    pool: &SqlitePool,
    slug: &str,
) -> anyhow::Result<std::collections::HashMap<String, f64>> {
    let rows = sqlx::query_as::<_, (String, Option<f64>)>(
        "SELECT card_name, inclusion_pct
         FROM edhrec_commander_cards
         WHERE commander_slug = ?",
    )
    .bind(slug)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|(name, pct)| pct.map(|p| (name, p)))
        .collect())
}

/// Load the user's MTG deck with commander + format. (load_user_deck in
/// db::analysis omits commander.)
pub async fn load_user_deck_full(
    pool: &SqlitePool,
    deck_name: &str,
    user_id: &str,
) -> anyhow::Result<Option<(String, Option<String>, Vec<serde_json::Value>)>> {
    let row = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT format,
                CAST(commander AS TEXT) as commander,
                CAST(cards AS TEXT) as cards
         FROM decks WHERE name = ? AND user_id = ?",
    )
    .bind(deck_name)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let Some((format, commander, cards_json)) = row else {
        return Ok(None);
    };
    let cards: Vec<serde_json::Value> = cards_json
        .as_deref()
        .map(|s| serde_json::from_str(s).unwrap_or_default())
        .unwrap_or_default();
    Ok(Some((format, commander, cards)))
}

/// Pre-filtered candidate pool: cards whose color identity is a subset of
/// the deck's, and (if enrichment has run) which are legal in `format`.
/// Filtering color identity at the SQL level cuts the 34k MTG card pool
/// down dramatically before the per-card scoring loop.
pub async fn load_candidate_cards(
    pool: &SqlitePool,
    format: &str,
    deck_color_identity: &[char],
) -> anyhow::Result<Vec<(serde_json::Value, bool)>> {
    let mut conditions: Vec<String> = Vec::new();
    let absent_colors: Vec<char> = ['W', 'U', 'B', 'R', 'G']
        .iter()
        .copied()
        .filter(|c| !deck_color_identity.contains(c))
        .collect();
    for c in &absent_colors {
        // String formatting is safe — `c` is one of WUBRG hardcoded above.
        conditions.push(format!("(coloridentity IS NULL OR coloridentity NOT LIKE '%\"{c}\"%')"));
    }
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };
    let sql = format!(
        "SELECT name,
                COALESCE(manacost, '') as manacost,
                CAST(COALESCE(cmc, 0) AS REAL) as cmc,
                COALESCE(coloridentity, '[]') as coloridentity,
                COALESCE(cardtype, '') as cardtype,
                COALESCE(typeline, '') as typeline,
                COALESCE(oracletext, '') as oracletext,
                CAST(power AS TEXT) as power,
                CAST(toughness AS TEXT) as toughness,
                COALESCE(legalities, '') as legalities
         FROM cards {where_clause}"
    );
    let rows = sqlx::query_as::<_, (
        String,
        String,
        f64,
        String,
        String,
        String,
        String,
        Option<String>,
        Option<String>,
        String,
    )>(&sql)
    .fetch_all(pool)
    .await?;

    let format_lower = format.to_lowercase();
    Ok(rows
        .into_iter()
        .map(
            |(name, manacost, cmc, coloridentity, cardtype, typeline, oracletext, power, toughness, legalities)| {
                let is_legal = is_legal_in(&legalities, &format_lower);
                let v = serde_json::json!({
                    "name": name,
                    "manacost": manacost,
                    "cmc": cmc,
                    "coloridentity": coloridentity,
                    "cardtype": cardtype,
                    "typeline": typeline,
                    "oracletext": oracletext,
                    "power": power,
                    "toughness": toughness,
                });
                (v, is_legal)
            },
        )
        .collect())
}

/// Check whether a card is legal in `format` given a JSON-string of
/// `{"<format>": "legal" | "not_legal" | ...}`. When the column is empty
/// (Scryfall enrichment hasn't run yet) we treat the card as legal so the
/// engine still produces useful results pre-enrichment.
fn is_legal_in(legalities_json: &str, format_lower: &str) -> bool {
    if legalities_json.is_empty() || legalities_json == "null" {
        return true;
    }
    let parsed: serde_json::Value = match serde_json::from_str(legalities_json) {
        Ok(v) => v,
        Err(_) => return true, // unparseable → don't drop the card
    };
    match parsed.get(format_lower).and_then(|v| v.as_str()) {
        Some("legal") | Some("restricted") => true,
        Some(_) => false,
        None => true, // no entry for this format → don't drop
    }
}
