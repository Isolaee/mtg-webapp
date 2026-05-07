use crate::models::User;
use sqlx::SqlitePool;

pub async fn find_by_username(pool: &SqlitePool, username: &str) -> anyhow::Result<Option<User>> {
    Ok(
        sqlx::query_as::<_, User>("SELECT id, username, password_hash FROM users WHERE username=?")
            .bind(username)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn insert(pool: &SqlitePool, username: &str, password_hash: &str) -> anyhow::Result<i64> {
    let id = sqlx::query("INSERT INTO users (username, password_hash) VALUES (?, ?)")
        .bind(username)
        .bind(password_hash)
        .execute(pool)
        .await?
        .last_insert_rowid();
    Ok(id)
}
