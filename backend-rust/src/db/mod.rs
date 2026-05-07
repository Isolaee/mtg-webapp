pub mod cards;
pub mod collection;
pub mod decks;
pub mod riftbound;
pub mod users;

use sqlx::SqlitePool;

pub async fn create_pool(database_url: &str) -> anyhow::Result<SqlitePool> {
    let pool = SqlitePool::connect(database_url).await?;
    riftbound::ensure_tables(&pool).await?;
    collection::ensure_tables(&pool).await?;
    migrate_columns(&pool).await?;
    Ok(pool)
}

async fn migrate_columns(pool: &SqlitePool) -> anyhow::Result<()> {
    // Ignore errors — column already exists after the first run.
    let _ = sqlx::query("ALTER TABLE decks ADD COLUMN user_id TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE rb_decks ADD COLUMN user_id TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'))",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0")
        .execute(pool)
        .await;
    Ok(())
}
