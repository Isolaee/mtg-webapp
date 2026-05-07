use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RbCard {
    pub id: String,
    pub name: String,
    pub set_id: String,
    pub collector_number: Option<i64>,
    pub rarity: String,
    pub faction: String,
    pub card_type: String,
    pub orientation: Option<String>,
    pub energy: Option<i64>,
    pub might: Option<i64>,
    pub power: Option<i64>,
    pub image: Option<String>,
    pub image_small: Option<String>,
    pub image_medium: Option<String>,
    pub image_large: Option<String>,
    pub art_image: Option<String>,
    pub art_artist: Option<String>,
    pub description: Option<String>,
    pub flavor_text: Option<String>,
    pub keywords: Option<String>,
    pub tags: Option<String>,
    pub is_banned: i64,
    pub prev_card_id: Option<String>,
    pub next_card_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RbDeck {
    pub id: i64,
    pub name: String,
    pub format: String,
    pub champion: Option<String>,
    pub main_deck: Option<String>,
    pub rune_deck: Option<String>,
    pub battlefields: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<String>,
}
