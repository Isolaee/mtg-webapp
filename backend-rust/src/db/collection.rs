use crate::models::CollectionEntry;
use sqlx::SqlitePool;

pub async fn ensure_tables(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS collection (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id  TEXT NOT NULL,
            game     TEXT NOT NULL,
            card_id  TEXT NOT NULL,
            is_foil  INTEGER NOT NULL DEFAULT 0,
            quantity INTEGER NOT NULL DEFAULT 1,
            added_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, game, card_id, is_foil)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS card_hashes (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            game    TEXT NOT NULL,
            card_id TEXT NOT NULL,
            phash   INTEGER NOT NULL,
            UNIQUE(game, card_id)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_card_hashes_phash ON card_hashes(phash)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn find_all_by_user(
    pool: &SqlitePool,
    user_id: &str,
    game: Option<&str>,
) -> anyhow::Result<Vec<CollectionEntry>> {
    Ok(match game {
        Some(g) => sqlx::query_as::<_, CollectionEntry>(
            "SELECT id, user_id, game, card_id, is_foil, quantity, added_at
             FROM collection WHERE user_id = ? AND game = ?
             ORDER BY game, card_id",
        )
        .bind(user_id)
        .bind(g)
        .fetch_all(pool)
        .await?,
        None => sqlx::query_as::<_, CollectionEntry>(
            "SELECT id, user_id, game, card_id, is_foil, quantity, added_at
             FROM collection WHERE user_id = ?
             ORDER BY game, card_id",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?,
    })
}

/// Inserts a new entry with quantity=1, or increments quantity on conflict.
pub async fn upsert(
    pool: &SqlitePool,
    user_id: &str,
    game: &str,
    card_id: &str,
    is_foil: bool,
) -> anyhow::Result<i64> {
    let row_id = sqlx::query(
        "INSERT INTO collection (user_id, game, card_id, is_foil, quantity)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(user_id, game, card_id, is_foil)
         DO UPDATE SET quantity = quantity + 1",
    )
    .bind(user_id)
    .bind(game)
    .bind(card_id)
    .bind(is_foil as i64)
    .execute(pool)
    .await?
    .last_insert_rowid();
    Ok(row_id)
}

pub async fn update_by_id_and_user(
    pool: &SqlitePool,
    id: i64,
    user_id: &str,
    quantity: Option<i64>,
    is_foil: Option<bool>,
) -> anyhow::Result<u64> {
    let mut sets: Vec<&str> = Vec::new();
    if quantity.is_some() {
        sets.push("quantity = ?");
    }
    if is_foil.is_some() {
        sets.push("is_foil = ?");
    }
    if sets.is_empty() {
        return Ok(0);
    }
    let sql = format!(
        "UPDATE collection SET {} WHERE id = ? AND user_id = ?",
        sets.join(", ")
    );
    let mut q = sqlx::query(&sql);
    if let Some(qty) = quantity {
        q = q.bind(qty);
    }
    if let Some(foil) = is_foil {
        q = q.bind(foil as i64);
    }
    q = q.bind(id).bind(user_id);
    Ok(q.execute(pool).await?.rows_affected())
}

pub async fn delete_by_id_and_user(
    pool: &SqlitePool,
    id: i64,
    user_id: &str,
) -> anyhow::Result<u64> {
    Ok(
        sqlx::query("DELETE FROM collection WHERE id = ? AND user_id = ?")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await?
            .rows_affected(),
    )
}
