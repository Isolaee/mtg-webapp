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
