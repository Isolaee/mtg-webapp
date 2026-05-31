use crate::models::Deck;
use sqlx::SqlitePool;

// Shared SELECT column list so every fetch hydrates the full Deck struct
// (including the sharing columns added by migrate_columns).
const SELECT_COLS: &str = "id, name, description, format,
        CAST(commander AS TEXT) as commander,
        CAST(cards AS TEXT) as cards,
        CAST(sideboard AS TEXT) as sideboard,
        CAST(maybeboard AS TEXT) as maybeboard,
        user_id,
        COALESCE(is_public, 0) as is_public,
        CAST(share_slug AS TEXT) as share_slug";

pub async fn find_all_by_user(pool: &SqlitePool, user_id: &str) -> anyhow::Result<Vec<Deck>> {
    let sql = format!("SELECT {SELECT_COLS} FROM decks WHERE user_id = ?");
    Ok(sqlx::query_as::<_, Deck>(&sql)
        .bind(user_id)
        .fetch_all(pool)
        .await?)
}

pub async fn find_by_name_and_user(
    pool: &SqlitePool,
    name: &str,
    user_id: &str,
) -> anyhow::Result<Option<Deck>> {
    let sql = format!("SELECT {SELECT_COLS} FROM decks WHERE name = ? AND user_id = ?");
    Ok(sqlx::query_as::<_, Deck>(&sql)
        .bind(name)
        .bind(user_id)
        .fetch_optional(pool)
        .await?)
}

// Public lookup by share slug — no user filter, and only returns decks the
// owner has explicitly marked public. Powers the unauthenticated share view.
pub async fn find_by_slug_public(
    pool: &SqlitePool,
    slug: &str,
) -> anyhow::Result<Option<Deck>> {
    let sql = format!("SELECT {SELECT_COLS} FROM decks WHERE share_slug = ? AND is_public = 1");
    Ok(sqlx::query_as::<_, Deck>(&sql)
        .bind(slug)
        .fetch_optional(pool)
        .await?)
}

pub async fn delete_by_name_and_user(
    pool: &SqlitePool,
    name: &str,
    user_id: &str,
) -> anyhow::Result<u64> {
    Ok(sqlx::query("DELETE FROM decks WHERE name = ? AND user_id = ?")
        .bind(name)
        .bind(user_id)
        .execute(pool)
        .await?
        .rows_affected())
}

#[allow(clippy::too_many_arguments)]
pub async fn insert(
    pool: &SqlitePool,
    name: &str,
    description: Option<&str>,
    format: &str,
    commander: Option<&str>,
    cards: Option<&str>,
    sideboard: Option<&str>,
    maybeboard: Option<&str>,
    user_id: &str,
    is_public: bool,
    share_slug: Option<&str>,
) -> anyhow::Result<i64> {
    let id = sqlx::query(
        "INSERT INTO decks (name, description, format, commander, cards, sideboard, maybeboard, user_id, is_public, share_slug)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(name)
    .bind(description)
    .bind(format)
    .bind(commander)
    .bind(cards)
    .bind(sideboard)
    .bind(maybeboard)
    .bind(user_id)
    .bind(if is_public { 1 } else { 0 })
    .bind(share_slug)
    .execute(pool)
    .await?
    .last_insert_rowid();
    Ok(id)
}
