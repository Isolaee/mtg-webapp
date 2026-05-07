use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Deck {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub format: String,
    pub commander: Option<String>,
    pub cards: Option<String>,
}
