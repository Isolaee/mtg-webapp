use crate::models::Deck;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> anyhow::Result<Vec<Deck>> {
    Ok(sqlx::query_as::<_, Deck>(
        "SELECT id, name, description, format,
                CAST(commander AS TEXT) as commander,
                CAST(cards AS TEXT) as cards
         FROM decks",
    )
    .fetch_all(pool)
    .await?)
}

pub async fn find_by_name(pool: &SqlitePool, name: &str) -> anyhow::Result<Option<Deck>> {
    Ok(sqlx::query_as::<_, Deck>(
        "SELECT id, name, description, format,
                CAST(commander AS TEXT) as commander,
                CAST(cards AS TEXT) as cards
         FROM decks WHERE name=?",
    )
    .bind(name)
    .fetch_optional(pool)
    .await?)
}

pub async fn insert(
    pool: &SqlitePool,
    name: &str,
    description: Option<&str>,
    format: &str,
    commander: Option<&str>,
    cards: Option<&str>,
) -> anyhow::Result<i64> {
    let id = sqlx::query(
        "INSERT INTO decks (name, description, format, commander, cards) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(name)
    .bind(description)
    .bind(format)
    .bind(commander)
    .bind(cards)
    .execute(pool)
    .await?
    .last_insert_rowid();
    Ok(id)
}
