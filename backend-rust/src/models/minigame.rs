use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Minigame {
    pub id: i64,
    #[serde(rename = "type")]
    pub r#type: String,
    pub game: Option<String>,
    pub prompt: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MinigameOption {
    pub id: i64,
    pub minigame_id: i64,
    pub label: String,
    pub card_id: Option<String>,
    pub image_url: Option<String>,
    pub position: i64,
}
