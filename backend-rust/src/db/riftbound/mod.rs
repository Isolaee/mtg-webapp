use crate::models::riftbound::{RbCard, RbDeck};
use sqlx::SqlitePool;

pub async fn ensure_tables(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS rb_cards (
            id               TEXT PRIMARY KEY,
            name             TEXT NOT NULL,
            set_id           TEXT NOT NULL,
            collector_number INTEGER,
            rarity           TEXT NOT NULL,
            faction          TEXT NOT NULL,
            card_type        TEXT NOT NULL,
            orientation      TEXT,
            energy           INTEGER,
            might            INTEGER,
            power            INTEGER,
            image            TEXT,
            image_small      TEXT,
            image_medium     TEXT,
            image_large      TEXT,
            art_image        TEXT,
            art_artist       TEXT,
            description      TEXT,
            flavor_text      TEXT,
            keywords         TEXT,
            tags             TEXT,
            is_banned        INTEGER NOT NULL DEFAULT 0,
            prev_card_id     TEXT,
            next_card_id     TEXT
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS rb_decks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            format      TEXT NOT NULL DEFAULT 'standard',
            champion    TEXT,
            main_deck   TEXT,
            rune_deck   TEXT,
            battlefields TEXT,
            description TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn find_all_cards(
    pool: &SqlitePool,
    set_id: Option<&str>,
    faction: Option<&str>,
    card_type: Option<&str>,
    rarity: Option<&str>,
    name: Option<&str>,
) -> anyhow::Result<Vec<RbCard>> {
    let mut conditions: Vec<String> = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    if let Some(v) = set_id {
        conditions.push("set_id = ?".into());
        binds.push(v.to_string());
    }
    if let Some(v) = faction {
        conditions.push("faction = ?".into());
        binds.push(v.to_string());
    }
    if let Some(v) = card_type {
        conditions.push("card_type = ?".into());
        binds.push(v.to_string());
    }
    if let Some(v) = rarity {
        conditions.push("rarity = ?".into());
        binds.push(v.to_string());
    }
    if let Some(v) = name {
        conditions.push("LOWER(name) LIKE ?".into());
        binds.push(format!("%{}%", v.to_lowercase()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, name, set_id, collector_number, rarity, faction, card_type,
                orientation, energy, might, power, image,
                image_small, image_medium, image_large,
                art_image, art_artist, description, flavor_text,
                keywords, tags, is_banned, prev_card_id, next_card_id
         FROM rb_cards{} ORDER BY set_id, collector_number",
        where_clause
    );

    let mut query = sqlx::query_as::<_, RbCard>(&sql);
    for b in &binds {
        query = query.bind(b);
    }

    Ok(query.fetch_all(pool).await?)
}

pub async fn find_card_by_id(pool: &SqlitePool, id: &str) -> anyhow::Result<Option<RbCard>> {
    Ok(sqlx::query_as::<_, RbCard>(
        "SELECT id, name, set_id, collector_number, rarity, faction, card_type,
                orientation, energy, might, power, image,
                image_small, image_medium, image_large,
                art_image, art_artist, description, flavor_text,
                keywords, tags, is_banned, prev_card_id, next_card_id
         FROM rb_cards WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?)
}

pub async fn upsert_card(pool: &SqlitePool, c: &RbCard) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO rb_cards (
            id, name, set_id, collector_number, rarity, faction, card_type,
            orientation, energy, might, power, image,
            image_small, image_medium, image_large,
            art_image, art_artist, description, flavor_text,
            keywords, tags, is_banned, prev_card_id, next_card_id
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, set_id=excluded.set_id,
            collector_number=excluded.collector_number, rarity=excluded.rarity,
            faction=excluded.faction, card_type=excluded.card_type,
            orientation=excluded.orientation, energy=excluded.energy,
            might=excluded.might, power=excluded.power, image=excluded.image,
            image_small=excluded.image_small, image_medium=excluded.image_medium,
            image_large=excluded.image_large, art_image=excluded.art_image,
            art_artist=excluded.art_artist, description=excluded.description,
            flavor_text=excluded.flavor_text, keywords=excluded.keywords,
            tags=excluded.tags, is_banned=excluded.is_banned,
            prev_card_id=excluded.prev_card_id, next_card_id=excluded.next_card_id",
    )
    .bind(&c.id)
    .bind(&c.name)
    .bind(&c.set_id)
    .bind(c.collector_number)
    .bind(&c.rarity)
    .bind(&c.faction)
    .bind(&c.card_type)
    .bind(&c.orientation)
    .bind(c.energy)
    .bind(c.might)
    .bind(c.power)
    .bind(&c.image)
    .bind(&c.image_small)
    .bind(&c.image_medium)
    .bind(&c.image_large)
    .bind(&c.art_image)
    .bind(&c.art_artist)
    .bind(&c.description)
    .bind(&c.flavor_text)
    .bind(&c.keywords)
    .bind(&c.tags)
    .bind(c.is_banned)
    .bind(&c.prev_card_id)
    .bind(&c.next_card_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn find_all_decks(pool: &SqlitePool) -> anyhow::Result<Vec<RbDeck>> {
    Ok(sqlx::query_as::<_, RbDeck>(
        "SELECT id, name, format, champion, main_deck, rune_deck, battlefields,
                description, created_at FROM rb_decks ORDER BY name",
    )
    .fetch_all(pool)
    .await?)
}

pub async fn find_deck_by_name(pool: &SqlitePool, name: &str) -> anyhow::Result<Option<RbDeck>> {
    Ok(sqlx::query_as::<_, RbDeck>(
        "SELECT id, name, format, champion, main_deck, rune_deck, battlefields,
                description, created_at FROM rb_decks WHERE name = ?",
    )
    .bind(name)
    .fetch_optional(pool)
    .await?)
}

pub async fn save_deck(pool: &SqlitePool, deck: &RbDeck) -> anyhow::Result<i64> {
    let row = sqlx::query(
        "INSERT INTO rb_decks (name, format, champion, main_deck, rune_deck, battlefields, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
            format=excluded.format, champion=excluded.champion,
            main_deck=excluded.main_deck, rune_deck=excluded.rune_deck,
            battlefields=excluded.battlefields, description=excluded.description",
    )
    .bind(&deck.name)
    .bind(&deck.format)
    .bind(&deck.champion)
    .bind(&deck.main_deck)
    .bind(&deck.rune_deck)
    .bind(&deck.battlefields)
    .bind(&deck.description)
    .execute(pool)
    .await?;

    Ok(row.last_insert_rowid())
}

pub async fn delete_deck(pool: &SqlitePool, name: &str) -> anyhow::Result<u64> {
    let result = sqlx::query("DELETE FROM rb_decks WHERE name = ?")
        .bind(name)
        .execute(pool)
        .await?;

    Ok(result.rows_affected())
}

pub async fn delete_card(pool: &SqlitePool, id: &str) -> anyhow::Result<u64> {
    let result = sqlx::query("DELETE FROM rb_cards WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected())
}
