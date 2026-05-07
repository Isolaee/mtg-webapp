pub mod cards;
pub mod decks;
pub mod riftbound;
pub mod users;

use sqlx::SqlitePool;

pub async fn create_pool(database_url: &str) -> anyhow::Result<SqlitePool> {
    let pool = SqlitePool::connect(database_url).await?;
    riftbound::ensure_tables(&pool).await?;
    Ok(pool)
}
