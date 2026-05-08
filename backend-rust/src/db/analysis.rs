use std::collections::HashMap;

use serde_json::Value;
use sqlx::SqlitePool;

use crate::analysis::DeckEntry;

// ── Table setup ──────────────────────────────────────────────────────────────

pub async fn ensure_tables(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS card_semantic_tags (
            card_name  TEXT PRIMARY KEY,
            tags       TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_cst_card_name ON card_semantic_tags(card_name)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

// ── Tag cache ────────────────────────────────────────────────────────────────

pub async fn get_tags_for_cards(
    pool: &SqlitePool,
    names: &[String],
) -> anyhow::Result<HashMap<String, Vec<String>>> {
    if names.is_empty() {
        return Ok(HashMap::new());
    }
    let placeholders = names.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!(
        "SELECT card_name, tags FROM card_semantic_tags WHERE card_name IN ({})",
        placeholders
    );
    let mut query = sqlx::query_as::<_, (String, String)>(&sql);
    for name in names {
        query = query.bind(name);
    }
    let rows = query.fetch_all(pool).await?;
    let mut map = HashMap::new();
    for (card_name, tags_json) in rows {
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        map.insert(card_name, tags);
    }
    Ok(map)
}

pub async fn upsert_tags(
    pool: &SqlitePool,
    card_name: &str,
    tags: &[String],
) -> anyhow::Result<()> {
    let tags_json = serde_json::to_string(tags)?;
    sqlx::query(
        "INSERT OR REPLACE INTO card_semantic_tags (card_name, tags, updated_at)
         VALUES (?, ?, datetime('now'))",
    )
    .bind(card_name)
    .bind(tags_json)
    .execute(pool)
    .await?;
    Ok(())
}

// ── MTG deck loading ─────────────────────────────────────────────────────────

/// Load a user's MTG deck. Returns (format, card_objects_array).
pub async fn load_user_deck(
    pool: &SqlitePool,
    deck_name: &str,
    user_id: &str,
) -> anyhow::Result<Option<(String, Vec<Value>)>> {
    let row = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT format, CAST(cards AS TEXT) as cards FROM decks WHERE name = ? AND user_id = ?",
    )
    .bind(deck_name)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let Some((format, cards_json)) = row else {
        return Ok(None);
    };
    let cards: Vec<Value> = cards_json
        .as_deref()
        .map(|s| serde_json::from_str(s).unwrap_or_default())
        .unwrap_or_default();
    Ok(Some((format, cards)))
}

/// Batch load MTG card rows by name. Returns a name→JSON map.
/// Uses LOWER() comparison for case-insensitive matching.
pub async fn load_cards_for_names(
    pool: &SqlitePool,
    names: &[String],
) -> anyhow::Result<HashMap<String, Value>> {
    if names.is_empty() {
        return Ok(HashMap::new());
    }
    let placeholders = names.iter().map(|_| "LOWER(?)").collect::<Vec<_>>().join(", ");
    let sql = format!(
        "SELECT name, COALESCE(manacost,'') as manacost,
                CAST(cmc AS REAL) as cmc,
                COALESCE(colors,'[]') as colors,
                COALESCE(coloridentity,'[]') as coloridentity,
                COALESCE(oracletext,'') as oracletext,
                COALESCE(cardtype,'') as cardtype,
                COALESCE(typeline,'') as typeline
         FROM cards WHERE LOWER(name) IN ({})",
        placeholders
    );
    let mut query = sqlx::query_as::<_, (String, String, f64, String, String, String, String, String)>(&sql);
    for name in names {
        query = query.bind(name.to_lowercase());
    }
    let rows = query.fetch_all(pool).await?;
    let mut map = HashMap::new();
    for (name, manacost, cmc, colors, coloridentity, oracletext, cardtype, typeline) in rows {
        let v = serde_json::json!({
            "name": name,
            "manacost": manacost,
            "cmc": cmc,
            "colors": colors,
            "coloridentity": coloridentity,
            "oracletext": oracletext,
            "cardtype": cardtype,
            "typeline": typeline,
        });
        map.insert(name, v);
    }
    Ok(map)
}

/// Load a tournament placement's decklist and event format.
pub async fn load_tournament_placement(
    pool: &SqlitePool,
    placement_id: i64,
) -> anyhow::Result<Option<(String, Vec<DeckEntry>)>> {
    let row = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        "SELECT tp.decklist, COALESCE(te.format, '') as format
         FROM tournament_placements tp
         JOIN tournament_events te ON tp.event_id = te.id
         WHERE tp.id = ?",
    )
    .bind(placement_id)
    .fetch_optional(pool)
    .await?;

    let Some((decklist_json, format)) = row else {
        return Ok(None);
    };
    let entries = parse_decklist(decklist_json.as_deref());
    Ok(Some((format.unwrap_or_default(), entries)))
}

fn parse_decklist(json: Option<&str>) -> Vec<DeckEntry> {
    let Some(s) = json else {
        return vec![];
    };
    #[derive(serde::Deserialize)]
    struct Raw {
        name: String,
        #[serde(default)]
        qty: u32,
        card_type: String,
    }
    let raws: Vec<Raw> = serde_json::from_str(s).unwrap_or_default();
    raws.into_iter()
        .map(|r| DeckEntry { name: r.name, qty: r.qty, card_type: r.card_type })
        .collect()
}

// ── Tournament placement loading ─────────────────────────────────────────────

pub struct TournamentPlacementRow {
    pub id: i64,
    pub player: Option<String>,
    pub placement: Option<i64>,
    pub record: Option<String>,
    pub decklist: Option<String>,
    pub format: Option<String>,
    pub event_name: String,
}

/// Load all tournament placements for a given game+format combination.
/// Filters out placements with empty or deck_url-only decklists.
pub async fn load_tournament_placements_for_format(
    pool: &SqlitePool,
    game: &str,
    format: &str,
    limit: i64,
) -> anyhow::Result<Vec<TournamentPlacementRow>> {
    let rows = sqlx::query_as::<_, (i64, Option<String>, Option<i64>, Option<String>, Option<String>, Option<String>, String)>(
        "SELECT tp.id, tp.player, tp.placement, tp.record, tp.decklist,
                te.format, te.name as event_name
         FROM tournament_placements tp
         JOIN tournament_events te ON tp.event_id = te.id
         WHERE te.game = ? AND LOWER(COALESCE(te.format,'')) = LOWER(?)
           AND tp.decklist IS NOT NULL AND tp.decklist != '[]'
         ORDER BY te.event_date DESC
         LIMIT ?",
    )
    .bind(game)
    .bind(format)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, player, placement, record, decklist, format, event_name)| {
            TournamentPlacementRow { id, player, placement, record, decklist, format, event_name }
        })
        .collect())
}

/// Load placements that need Riftdecks enrichment (contain deck_url entries).
pub async fn load_placements_needing_enrichment(
    pool: &SqlitePool,
) -> anyhow::Result<Vec<(i64, String)>> {
    let rows = sqlx::query_as::<_, (i64, String)>(
        "SELECT tp.id, tp.decklist
         FROM tournament_placements tp
         JOIN tournament_events te ON tp.event_id = te.id
         WHERE te.game = 'riftbound'
           AND tp.decklist LIKE '%\"deck_url\"%'",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// ── MTG card precompute ──────────────────────────────────────────────────────

pub async fn load_all_card_names_and_oracle(
    pool: &SqlitePool,
) -> anyhow::Result<Vec<(String, serde_json::Value)>> {
    let rows = sqlx::query_as::<_, (String, String, f64, String, String, String, String, String)>(
        "SELECT name,
                COALESCE(manacost,'') as manacost,
                CAST(COALESCE(cmc,0) AS REAL) as cmc,
                COALESCE(colors,'[]') as colors,
                COALESCE(coloridentity,'[]') as coloridentity,
                COALESCE(oracletext,'') as oracletext,
                COALESCE(cardtype,'') as cardtype,
                COALESCE(typeline,'') as typeline
         FROM cards",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(name, manacost, cmc, colors, coloridentity, oracletext, cardtype, typeline)| {
            let v = serde_json::json!({
                "name": &name,
                "manacost": manacost,
                "cmc": cmc,
                "colors": colors,
                "coloridentity": coloridentity,
                "oracletext": oracletext,
                "cardtype": cardtype,
                "typeline": typeline,
            });
            (name, v)
        })
        .collect())
}

// ── Riftbound deck loading ────────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
struct RbDeckEntryRaw {
    id: String,
    #[serde(default = "one")]
    count: u32,
}
fn one() -> u32 {
    1
}

/// Load a Riftbound user deck. Returns (format, champion_id, main_deck_entries).
pub async fn load_rb_user_deck(
    pool: &SqlitePool,
    deck_name: &str,
    user_id: &str,
) -> anyhow::Result<Option<(String, Option<String>, Vec<DeckEntry>)>> {
    let row = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT format, champion, main_deck FROM rb_decks WHERE name = ? AND user_id = ?",
    )
    .bind(deck_name)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let Some((format, champion, main_deck_json)) = row else {
        return Ok(None);
    };

    let mut entries: Vec<DeckEntry> = Vec::new();
    if let Some(champion_id) = &champion {
        entries.push(DeckEntry {
            name: champion_id.clone(),
            qty: 1,
            card_type: "champion".to_string(),
        });
    }
    if let Some(json) = main_deck_json {
        let raws: Vec<RbDeckEntryRaw> = serde_json::from_str(&json).unwrap_or_default();
        for r in raws {
            entries.push(DeckEntry { name: r.id, qty: r.count, card_type: "main".to_string() });
        }
    }
    Ok(Some((format, champion, entries)))
}

/// Batch load Riftbound cards by ID. Returns id→JSON map.
pub async fn load_rb_cards_for_ids(
    pool: &SqlitePool,
    ids: &[String],
) -> anyhow::Result<HashMap<String, Value>> {
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!(
        "SELECT id, faction, card_type, energy, might, power,
                COALESCE(description,'') as description,
                COALESCE(keywords,'[]') as keywords,
                COALESCE(tags,'[]') as tags
         FROM rb_cards WHERE id IN ({})",
        placeholders
    );
    let mut query = sqlx::query_as::<_, (String, String, String, Option<i64>, Option<i64>, Option<i64>, String, String, String)>(&sql);
    for id in ids {
        query = query.bind(id);
    }
    let rows = query.fetch_all(pool).await?;
    let mut map = HashMap::new();
    for (id, faction, card_type, energy, might, power, description, keywords, tags) in rows {
        let v = serde_json::json!({
            "id": id,
            "faction": faction,
            "card_type": card_type,
            "energy": energy,
            "might": might,
            "power": power,
            "description": description,
            "keywords": keywords,
            "tags": tags,
        });
        map.insert(id, v);
    }
    Ok(map)
}

/// Load all Riftbound cards for precompute.
pub async fn load_all_rb_card_ids_and_data(
    pool: &SqlitePool,
) -> anyhow::Result<Vec<(String, Value)>> {
    let rows = sqlx::query_as::<_, (String, String, String, Option<i64>, Option<i64>, Option<i64>, String, String, String)>(
        "SELECT id, faction, card_type, energy, might, power,
                COALESCE(description,'') as description,
                COALESCE(keywords,'[]') as keywords,
                COALESCE(tags,'[]') as tags
         FROM rb_cards",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, faction, card_type, energy, might, power, description, keywords, tags)| {
            let v = serde_json::json!({
                "id": &id,
                "faction": faction,
                "card_type": card_type,
                "energy": energy,
                "might": might,
                "power": power,
                "description": description,
                "keywords": keywords,
                "tags": tags,
            });
            (id, v)
        })
        .collect())
}
