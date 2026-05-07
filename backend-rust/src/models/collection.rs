use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CollectionEntry {
    pub id: i64,
    pub user_id: String,
    pub game: String,
    pub card_id: String,
    pub is_foil: i64,
    pub quantity: i64,
    pub added_at: Option<String>,
}
