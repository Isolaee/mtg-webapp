use crate::models::Deck;
use sqlx::SqlitePool;

pub async fn find_all_by_user(pool: &SqlitePool, user_id: &str) -> anyhow::Result<Vec<Deck>> {
    Ok(sqlx::query_as::<_, Deck>(
        "SELECT id, name, description, format,
                CAST(commander AS TEXT) as commander,
                CAST(cards AS TEXT) as cards,
                CAST(sideboard AS TEXT) as sideboard,
                CAST(maybeboard AS TEXT) as maybeboard,
                user_id
         FROM decks WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?)
}

pub async fn find_by_name_and_user(
    pool: &SqlitePool,
    name: &str,
    user_id: &str,
) -> anyhow::Result<Option<Deck>> {
    Ok(sqlx::query_as::<_, Deck>(
        "SELECT id, name, description, format,
                CAST(commander AS TEXT) as commander,
                CAST(cards AS TEXT) as cards,
                CAST(sideboard AS TEXT) as sideboard,
                CAST(maybeboard AS TEXT) as maybeboard,
                user_id
         FROM decks WHERE name = ? AND user_id = ?",
    )
    .bind(name)
    .bind(user_id)
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
) -> anyhow::Result<i64> {
    let id = sqlx::query(
        "INSERT INTO decks (name, description, format, commander, cards, sideboard, maybeboard, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(name)
    .bind(description)
    .bind(format)
    .bind(commander)
    .bind(cards)
    .bind(sideboard)
    .bind(maybeboard)
    .bind(user_id)
    .execute(pool)
    .await?
    .last_insert_rowid();
    Ok(id)
}
