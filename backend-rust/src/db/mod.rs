pub mod cards;
pub mod decks;
pub mod users;

use sqlx::SqlitePool;

pub async fn create_pool(database_url: &str) -> anyhow::Result<SqlitePool> {
    let pool = SqlitePool::connect(database_url).await?;
    Ok(pool)
}
