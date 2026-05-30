use crate::models::CollectionEntry;
use sqlx::SqlitePool;

pub async fn ensure_tables(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS collection (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id   TEXT NOT NULL,
            game      TEXT NOT NULL,
            card_id   TEXT NOT NULL,
            is_foil   INTEGER NOT NULL DEFAULT 0,
            treatment TEXT NOT NULL DEFAULT 'Normal',
            quantity  INTEGER NOT NULL DEFAULT 1,
            added_at  TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, game, card_id, is_foil, treatment)
        )",
    )
    .execute(pool)
    .await?;

    migrate_add_treatment(pool).await?;

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

/// Migrates a pre-existing `collection` table to add the `treatment` column.
/// The old table-level `UNIQUE(user_id, game, card_id, is_foil)` constraint can't be
/// altered in place, so we rename-rebuild-copy-drop inside a transaction. Runs once:
/// subsequent startups see the `treatment` column and skip.
async fn migrate_add_treatment(pool: &SqlitePool) -> anyhow::Result<()> {
    let cols = sqlx::query_as::<_, (i64, String, String, i64, Option<String>, i64)>(
        "PRAGMA table_info(collection)",
    )
    .fetch_all(pool)
    .await?;
    if cols.iter().any(|c| c.1 == "treatment") {
        return Ok(());
    }

    let mut tx = pool.begin().await?;
    sqlx::query("ALTER TABLE collection RENAME TO collection_old")
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "CREATE TABLE collection (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id   TEXT NOT NULL,
            game      TEXT NOT NULL,
            card_id   TEXT NOT NULL,
            is_foil   INTEGER NOT NULL DEFAULT 0,
            treatment TEXT NOT NULL DEFAULT 'Normal',
            quantity  INTEGER NOT NULL DEFAULT 1,
            added_at  TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, game, card_id, is_foil, treatment)
        )",
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO collection (id, user_id, game, card_id, is_foil, treatment, quantity, added_at)
         SELECT id, user_id, game, card_id, is_foil, 'Normal', quantity, added_at FROM collection_old",
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query("DROP TABLE collection_old")
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    tracing::info!("migrated collection table: added treatment column");
    Ok(())
}

pub async fn find_all_by_user(
    pool: &SqlitePool,
    user_id: &str,
    game: Option<&str>,
) -> anyhow::Result<Vec<CollectionEntry>> {
    Ok(match game {
        Some(g) => sqlx::query_as::<_, CollectionEntry>(
            "SELECT id, user_id, game, card_id, is_foil, treatment, quantity, added_at
             FROM collection WHERE user_id = ? AND game = ?
             ORDER BY game, card_id",
        )
        .bind(user_id)
        .bind(g)
        .fetch_all(pool)
        .await?,
        None => sqlx::query_as::<_, CollectionEntry>(
            "SELECT id, user_id, game, card_id, is_foil, treatment, quantity, added_at
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
    treatment: &str,
) -> anyhow::Result<i64> {
    let row_id = sqlx::query(
        "INSERT INTO collection (user_id, game, card_id, is_foil, treatment, quantity)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(user_id, game, card_id, is_foil, treatment)
         DO UPDATE SET quantity = quantity + 1",
    )
    .bind(user_id)
    .bind(game)
    .bind(card_id)
    .bind(is_foil as i64)
    .bind(treatment)
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
    treatment: Option<String>,
) -> anyhow::Result<u64> {
    let mut sets: Vec<&str> = Vec::new();
    if quantity.is_some() {
        sets.push("quantity = ?");
    }
    if is_foil.is_some() {
        sets.push("is_foil = ?");
    }
    if treatment.is_some() {
        sets.push("treatment = ?");
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
    if let Some(t) = treatment {
        q = q.bind(t);
    }
    q = q.bind(id).bind(user_id);
    Ok(q.execute(pool).await?.rows_affected())
}

pub struct HashRow {
    pub game: String,
    pub card_id: String,
    pub phash: i64,
}

pub async fn find_all_hashes(pool: &SqlitePool) -> anyhow::Result<Vec<HashRow>> {
    let rows = sqlx::query_as::<_, (String, String, i64)>(
        "SELECT game, card_id, phash FROM card_hashes",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(game, card_id, phash)| HashRow { game, card_id, phash })
        .collect())
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
