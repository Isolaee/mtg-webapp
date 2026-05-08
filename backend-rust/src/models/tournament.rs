use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TournamentEvent {
    pub id: i64,
    pub source: String,
    pub external_id: String,
    pub name: String,
    pub game: String,
    pub format: Option<String>,
    pub event_date: Option<String>,
    pub scraped_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TournamentPlacement {
    pub id: i64,
    pub event_id: i64,
    pub placement: Option<i64>,
    pub player: Option<String>,
    pub record: Option<String>,
    pub decklist: Option<String>,
}
