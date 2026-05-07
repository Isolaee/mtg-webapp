pub mod cards;
pub mod decks;
pub mod riftbound;
pub mod users;

use sqlx::SqlitePool;

pub async fn create_pool(database_url: &str) -> anyhow::Result<SqlitePool> {
    let pool = SqlitePool::connect(database_url).await?;
    riftbound::ensure_tables(&pool).await?;
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
    Ok(())
}
