use crate::models::Card;
use sqlx::SqlitePool;

const SELECT_COLS: &str =
    "name, manacost, CAST(cmc AS REAL) as cmc, colors, coloridentity,
     CAST(power AS TEXT) as power, CAST(toughness AS TEXT) as toughness,
     oracletext, CAST(loyalty AS TEXT) as loyalty, supertype,
     cardtype, typeline, artist, legalities, image";

pub async fn find_all(pool: &SqlitePool) -> anyhow::Result<Vec<Card>> {
    let sql = format!("SELECT {SELECT_COLS} FROM cards");
    Ok(sqlx::query_as::<_, Card>(&sql).fetch_all(pool).await?)
}

pub async fn find_by_names(pool: &SqlitePool, names: &[String]) -> anyhow::Result<Vec<Card>> {
    let conditions = names
        .iter()
        .map(|_| "LOWER(name) LIKE ?")
        .collect::<Vec<_>>()
        .join(" OR ");
    let sql = format!("SELECT {SELECT_COLS} FROM cards WHERE {conditions}");
    let mut query = sqlx::query_as::<_, Card>(&sql);
    for name in names {
        query = query.bind(format!("%{}%", name.to_lowercase()));
    }
    Ok(query.fetch_all(pool).await?)
}

pub async fn find_with_filters(
    pool: &SqlitePool,
    name: Option<&str>,
    card_type: Option<&str>,
    color: Option<&str>,
) -> anyhow::Result<Vec<Card>> {
    let mut conditions: Vec<&str> = Vec::new();
    let mut name_bind = String::new();
    let mut type_bind = String::new();
    let mut color_bind = String::new();

    if let Some(n) = name {
        if !n.trim().is_empty() {
            conditions.push("LOWER(name) LIKE ?");
            name_bind = format!("%{}%", n.trim().to_lowercase());
        }
    }
    if let Some(t) = card_type {
        if !t.trim().is_empty() {
            conditions.push("cardtype LIKE ?");
            type_bind = format!("%{}%", t.trim());
        }
    }
    if let Some(c) = color {
        if !c.trim().is_empty() {
            if c == "C" {
                conditions.push("colors = '[]'");
            } else {
                conditions.push("colors LIKE ?");
                color_bind = format!("%\"{}\"", c.trim().to_uppercase());
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!("SELECT {SELECT_COLS} FROM cards {where_clause} ORDER BY name LIMIT 200");
    let mut query = sqlx::query_as::<_, Card>(&sql);

    if !name_bind.is_empty() {
        query = query.bind(name_bind);
    }
    if !type_bind.is_empty() {
        query = query.bind(type_bind);
    }
    if color != Some("C") && !color_bind.is_empty() {
        query = query.bind(color_bind);
    }

    Ok(query.fetch_all(pool).await?)
}

pub async fn find_by_name_exact(pool: &SqlitePool, name: &str) -> anyhow::Result<Option<Card>> {
    let sql = format!("SELECT {SELECT_COLS} FROM cards WHERE LOWER(name) = LOWER(?)");
    Ok(sqlx::query_as::<_, Card>(&sql)
        .bind(name)
        .fetch_optional(pool)
        .await?)
}

pub async fn insert(pool: &SqlitePool, card: &Card) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO cards (name, manacost, cmc, colors, coloridentity, power, toughness,
                            oracletext, loyalty, supertype, cardtype, typeline, artist, legalities, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&card.name)
    .bind(&card.manacost)
    .bind(card.cmc)
    .bind(&card.colors)
    .bind(&card.coloridentity)
    .bind(&card.power)
    .bind(&card.toughness)
    .bind(&card.oracletext)
    .bind(&card.loyalty)
    .bind(&card.supertype)
    .bind(&card.cardtype)
    .bind(&card.typeline)
    .bind(&card.artist)
    .bind(&card.legalities)
    .bind(&card.image)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, name: &str, card: &Card) -> anyhow::Result<bool> {
    let rows = sqlx::query(
        "UPDATE cards SET manacost=?, cmc=?, colors=?, coloridentity=?, power=?, toughness=?,
                          oracletext=?, loyalty=?, supertype=?, cardtype=?, typeline=?,
                          artist=?, legalities=?, image=?
         WHERE name=?",
    )
    .bind(&card.manacost)
    .bind(card.cmc)
    .bind(&card.colors)
    .bind(&card.coloridentity)
    .bind(&card.power)
    .bind(&card.toughness)
    .bind(&card.oracletext)
    .bind(&card.loyalty)
    .bind(&card.supertype)
    .bind(&card.cardtype)
    .bind(&card.typeline)
    .bind(&card.artist)
    .bind(&card.legalities)
    .bind(&card.image)
    .bind(name)
    .execute(pool)
    .await?
    .rows_affected();
    Ok(rows > 0)
}

pub async fn delete(pool: &SqlitePool, name: &str) -> anyhow::Result<bool> {
    let rows = sqlx::query("DELETE FROM cards WHERE name=?")
        .bind(name)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(rows > 0)
}
