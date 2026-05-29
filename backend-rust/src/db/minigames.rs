use crate::models::minigame::{Minigame, MinigameOption};
use sqlx::SqlitePool;

pub async fn ensure_tables(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS minigames (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            type       TEXT NOT NULL,
            game       TEXT,
            prompt     TEXT NOT NULL,
            status     TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS minigame_options (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            minigame_id INTEGER NOT NULL,
            label       TEXT NOT NULL,
            card_id     TEXT,
            image_url   TEXT,
            position    INTEGER NOT NULL DEFAULT 0
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS minigame_votes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            minigame_id INTEGER NOT NULL,
            option_id   INTEGER NOT NULL,
            voter_key   TEXT NOT NULL,
            user_id     TEXT,
            voted_at    TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(minigame_id, voter_key)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_minigame_votes_game ON minigame_votes(minigame_id)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_active(pool: &SqlitePool) -> anyhow::Result<Vec<Minigame>> {
    Ok(sqlx::query_as::<_, Minigame>(
        "SELECT id, type, game, prompt, status, created_at
         FROM minigames WHERE status = 'active'
         ORDER BY created_at DESC, id DESC",
    )
    .fetch_all(pool)
    .await?)
}

pub async fn get_minigame(pool: &SqlitePool, id: i64) -> anyhow::Result<Option<Minigame>> {
    Ok(sqlx::query_as::<_, Minigame>(
        "SELECT id, type, game, prompt, status, created_at
         FROM minigames WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?)
}

pub async fn get_options(pool: &SqlitePool, minigame_id: i64) -> anyhow::Result<Vec<MinigameOption>> {
    Ok(sqlx::query_as::<_, MinigameOption>(
        "SELECT id, minigame_id, label, card_id, image_url, position
         FROM minigame_options WHERE minigame_id = ?
         ORDER BY position ASC, id ASC",
    )
    .bind(minigame_id)
    .fetch_all(pool)
    .await?)
}

pub struct NewOption {
    pub label: String,
    pub card_id: Option<String>,
    pub image_url: Option<String>,
    pub position: i64,
}

/// Inserts a minigame and its options, returns the new minigame id.
pub async fn create_minigame(
    pool: &SqlitePool,
    r#type: &str,
    game: Option<&str>,
    prompt: &str,
    status: &str,
    options: &[NewOption],
) -> anyhow::Result<i64> {
    let mut tx = pool.begin().await?;

    let minigame_id = sqlx::query(
        "INSERT INTO minigames (type, game, prompt, status) VALUES (?, ?, ?, ?)",
    )
    .bind(r#type)
    .bind(game)
    .bind(prompt)
    .bind(status)
    .execute(&mut *tx)
    .await?
    .last_insert_rowid();

    for opt in options {
        sqlx::query(
            "INSERT INTO minigame_options (minigame_id, label, card_id, image_url, position)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(minigame_id)
        .bind(&opt.label)
        .bind(&opt.card_id)
        .bind(&opt.image_url)
        .bind(opt.position)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(minigame_id)
}

/// Returns true if the option belongs to the given minigame.
pub async fn option_belongs(pool: &SqlitePool, minigame_id: i64, option_id: i64) -> anyhow::Result<bool> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM minigame_options WHERE id = ? AND minigame_id = ?",
    )
    .bind(option_id)
    .bind(minigame_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.is_some())
}

/// Records a vote, ignoring duplicates (same minigame + voter_key).
pub async fn insert_vote(
    pool: &SqlitePool,
    minigame_id: i64,
    option_id: i64,
    voter_key: &str,
    user_id: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO minigame_votes (minigame_id, option_id, voter_key, user_id)
         VALUES (?, ?, ?, ?)",
    )
    .bind(minigame_id)
    .bind(option_id)
    .bind(voter_key)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Per-option vote counts (zero-vote options included via LEFT JOIN), ordered by option position.
pub async fn aggregate(pool: &SqlitePool, minigame_id: i64) -> anyhow::Result<Vec<(i64, i64)>> {
    Ok(sqlx::query_as::<_, (i64, i64)>(
        "SELECT o.id, COUNT(v.id) AS votes
         FROM minigame_options o
         LEFT JOIN minigame_votes v
           ON v.option_id = o.id AND v.minigame_id = ?
         WHERE o.minigame_id = ?
         GROUP BY o.id
         ORDER BY o.position ASC, o.id ASC",
    )
    .bind(minigame_id)
    .bind(minigame_id)
    .fetch_all(pool)
    .await?)
}
