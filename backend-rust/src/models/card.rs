use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Card {
    pub name: String,
    pub manacost: Option<String>,
    pub cmc: Option<f64>,
    pub colors: Option<String>,
    #[serde(rename = "colorIdentity")]
    pub coloridentity: Option<String>,
    pub power: Option<String>,
    pub toughness: Option<String>,
    #[serde(rename = "oracleText")]
    pub oracletext: Option<String>,
    pub loyalty: Option<String>,
    pub supertype: Option<String>,
    #[serde(rename = "cardType")]
    pub cardtype: Option<String>,
    pub typeline: Option<String>,
    pub artist: Option<String>,
    pub legalities: Option<String>,
    pub image: Option<String>,
}
