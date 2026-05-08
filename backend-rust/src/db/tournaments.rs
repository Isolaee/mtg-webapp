use crate::models::tournament::{TournamentEvent, TournamentPlacement};
use sqlx::SqlitePool;

pub async fn ensure_tables(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tournament_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            source      TEXT NOT NULL,
            external_id TEXT NOT NULL,
            name        TEXT NOT NULL,
            game        TEXT NOT NULL,
            format      TEXT,
            event_date  TEXT,
            scraped_at  TEXT NOT NULL,
            UNIQUE(source, external_id)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tournament_placements (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id    INTEGER NOT NULL REFERENCES tournament_events(id),
            placement   INTEGER,
            player      TEXT,
            record      TEXT,
            decklist    TEXT
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Insert event, returning its row id. Returns None if the event already exists.
pub async fn upsert_event(
    pool: &SqlitePool,
    source: &str,
    external_id: &str,
    name: &str,
    game: &str,
    format: Option<&str>,
    event_date: Option<&str>,
    scraped_at: &str,
) -> anyhow::Result<Option<i64>> {
    let result = sqlx::query(
        "INSERT OR IGNORE INTO tournament_events
            (source, external_id, name, game, format, event_date, scraped_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(source)
    .bind(external_id)
    .bind(name)
    .bind(game)
    .bind(format)
    .bind(event_date)
    .bind(scraped_at)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Ok(None);
    }

    Ok(Some(result.last_insert_rowid()))
}

pub async fn insert_placement(
    pool: &SqlitePool,
    event_id: i64,
    placement: Option<i64>,
    player: Option<&str>,
    record: Option<&str>,
    decklist: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO tournament_placements (event_id, placement, player, record, decklist)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(event_id)
    .bind(placement)
    .bind(player)
    .bind(record)
    .bind(decklist)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_events(
    pool: &SqlitePool,
    game: Option<&str>,
    format: Option<&str>,
    limit: i64,
) -> anyhow::Result<Vec<TournamentEvent>> {
    let mut conditions: Vec<String> = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    if let Some(v) = game {
        conditions.push("game = ?".into());
        binds.push(v.to_string());
    }
    if let Some(v) = format {
        conditions.push("format = ?".into());
        binds.push(v.to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, source, external_id, name, game, format, event_date, scraped_at
         FROM tournament_events{} ORDER BY scraped_at DESC LIMIT ?",
        where_clause
    );

    let mut query = sqlx::query_as::<_, TournamentEvent>(&sql);
    for b in &binds {
        query = query.bind(b);
    }
    query = query.bind(limit);

    Ok(query.fetch_all(pool).await?)
}

pub async fn list_placements(
    pool: &SqlitePool,
    event_id: i64,
) -> anyhow::Result<Vec<TournamentPlacement>> {
    Ok(sqlx::query_as::<_, TournamentPlacement>(
        "SELECT id, event_id, placement, player, record, decklist
         FROM tournament_placements WHERE event_id = ? ORDER BY placement ASC NULLS LAST",
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?)
}

pub async fn update_placement_decklist(
    pool: &SqlitePool,
    placement_id: i64,
    decklist_json: &str,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE tournament_placements SET decklist = ? WHERE id = ?")
        .bind(decklist_json)
        .bind(placement_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_event(pool: &SqlitePool, id: i64) -> anyhow::Result<Option<TournamentEvent>> {
    Ok(sqlx::query_as::<_, TournamentEvent>(
        "SELECT id, source, external_id, name, game, format, event_date, scraped_at
         FROM tournament_events WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?)
}
