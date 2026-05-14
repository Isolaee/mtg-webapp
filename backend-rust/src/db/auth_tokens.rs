use sqlx::SqlitePool;

pub async fn ensure_table(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS revoked_tokens (
            jti TEXT PRIMARY KEY,
            revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn revoke(pool: &SqlitePool, jti: &str) -> anyhow::Result<()> {
    sqlx::query("INSERT OR IGNORE INTO revoked_tokens (jti) VALUES (?)")
        .bind(jti)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn is_revoked(pool: &SqlitePool, jti: &str) -> anyhow::Result<bool> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT jti FROM revoked_tokens WHERE jti = ?")
            .bind(jti)
            .fetch_optional(pool)
            .await?;
    Ok(row.is_some())
}
