pub mod cards;
pub mod decks;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .merge(cards::router(pool.clone()))
        .merge(decks::router(pool))
}
