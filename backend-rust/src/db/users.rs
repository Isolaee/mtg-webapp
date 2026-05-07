use crate::models::User;
use sqlx::SqlitePool;

pub async fn find_by_username(pool: &SqlitePool, username: &str) -> anyhow::Result<Option<User>> {
    Ok(sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, created_at FROM users WHERE username=?",
    )
    .bind(username)
    .fetch_optional(pool)
    .await?)
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

pub async fn update_password(
    pool: &SqlitePool,
    username: &str,
    new_hash: &str,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE users SET password_hash=? WHERE username=?")
        .bind(new_hash)
        .bind(username)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn count_mtg_decks(pool: &SqlitePool, username: &str) -> anyhow::Result<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM decks WHERE user_id=?")
        .bind(username)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

pub async fn count_rb_decks(pool: &SqlitePool, username: &str) -> anyhow::Result<i64> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM rb_decks WHERE user_id=?")
        .bind(username)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}
