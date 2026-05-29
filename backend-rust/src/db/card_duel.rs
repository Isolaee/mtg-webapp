// Card-duel ("which card is stronger?") storage: per-(game,format) ELO ratings,
// random eligible-card selection, ELO updates, an append-only vote audit log,
// and the per-format leaderboard.
//
// `card_id` holds an MTG card name OR a Riftbound card id (rb_cards.id).
// MTG legality is filtered in SQL by matching the `legalities` JSON for the
// chosen format == "legal" OR "restricted". This intentionally diverges from
// `db::upgrades::is_legal_in` (which treats a missing format key / empty
// legalities as legal): for the duel we only deal cards explicitly legal or
// restricted in the format, so un-enriched cards never appear.

use sqlx::{Sqlite, SqlitePool, Transaction};

const DEFAULT_ELO: f64 = 1500.0;
const K_FACTOR: f64 = 32.0;

#[derive(Debug, Clone, serde::Serialize)]
pub struct DuelCardRow {
    pub card_id: String,
    pub name: String,
    pub image: Option<String>,
    pub elo: f64,
}

pub struct EloOutcome {
    pub winner_old: f64,
    pub winner_new: f64,
    pub loser_old: f64,
    pub loser_new: f64,
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct LeaderboardRow {
    pub name: String,
    pub image: Option<String>,
    pub elo: f64,
    pub games_played: i64,
    pub wins: i64,
}

pub async fn ensure_tables(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS card_elo (
            game         TEXT NOT NULL,
            format       TEXT NOT NULL,
            card_id      TEXT NOT NULL,
            elo          REAL NOT NULL DEFAULT 1500,
            games_played INTEGER NOT NULL DEFAULT 0,
            wins         INTEGER NOT NULL DEFAULT 0,
            updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (game, format, card_id)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_card_elo_board ON card_elo(game, format, elo DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS card_duel_votes (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            game           TEXT NOT NULL,
            format         TEXT NOT NULL,
            winner_card_id TEXT NOT NULL,
            loser_card_id  TEXT NOT NULL,
            voter_key      TEXT NOT NULL,
            user_id        TEXT,
            created_at     TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_duel_votes_scope ON card_duel_votes(game, format, created_at)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

// The stored `legalities` JSON uses `"fmt": "legal"` (space after the colon),
// but be robust to a spaceless serialization too. Match the exact quoted value
// `"legal"`/`"restricted"` so we never match the `legal` inside `"not_legal"`.
const LEGALITY_OR_CLAUSE: &str =
    "(legalities LIKE ? OR legalities LIKE ? OR legalities LIKE ? OR legalities LIKE ?)";

fn mtg_legality_patterns(fmt: &str) -> [String; 4] {
    [
        format!(r#"%"{fmt}": "legal"%"#),
        format!(r#"%"{fmt}":"legal"%"#),
        format!(r#"%"{fmt}": "restricted"%"#),
        format!(r#"%"{fmt}":"restricted"%"#),
    ]
}

/// Current rating for a card, or the default if it has never been rated.
pub async fn elo_for(pool: &SqlitePool, game: &str, fmt: &str, card_id: &str) -> anyhow::Result<f64> {
    let row = sqlx::query_as::<_, (f64,)>(
        "SELECT elo FROM card_elo WHERE game = ? AND format = ? AND card_id = ?",
    )
    .bind(game)
    .bind(fmt)
    .bind(card_id)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| r.0).unwrap_or(DEFAULT_ELO))
}

/// Two distinct random MTG cards legal/restricted in `fmt`, each with an image.
pub async fn pick_mtg_pair(
    pool: &SqlitePool,
    fmt: &str,
) -> anyhow::Result<Option<(DuelCardRow, DuelCardRow)>> {
    let patterns = mtg_legality_patterns(fmt);
    let sql = format!(
        "SELECT name, image FROM cards
         WHERE image IS NOT NULL AND TRIM(image) != ''
           AND {LEGALITY_OR_CLAUSE}
         ORDER BY RANDOM() LIMIT 2"
    );
    let mut query = sqlx::query_as::<_, (String, Option<String>)>(&sql);
    for p in &patterns {
        query = query.bind(p);
    }
    let rows = query.fetch_all(pool).await?;

    if rows.len() < 2 {
        return Ok(None);
    }
    let mut cards = Vec::with_capacity(2);
    for (name, image) in rows {
        let elo = elo_for(pool, "mtg", fmt, &name).await?;
        cards.push(DuelCardRow { card_id: name.clone(), name, image, elo });
    }
    let mut it = cards.into_iter();
    Ok(Some((it.next().unwrap(), it.next().unwrap())))
}

/// Two distinct random Riftbound cards (single "all" pool), each with an image.
pub async fn pick_rb_pair(pool: &SqlitePool) -> anyhow::Result<Option<(DuelCardRow, DuelCardRow)>> {
    let rows = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT id, name, COALESCE(image_medium, image) AS image FROM rb_cards
         WHERE COALESCE(image_medium, image) IS NOT NULL
         ORDER BY RANDOM() LIMIT 2",
    )
    .fetch_all(pool)
    .await?;

    if rows.len() < 2 {
        return Ok(None);
    }
    let mut cards = Vec::with_capacity(2);
    for (id, name, image) in rows {
        let elo = elo_for(pool, "riftbound", "all", &id).await?;
        cards.push(DuelCardRow { card_id: id, name, image, elo });
    }
    let mut it = cards.into_iter();
    Ok(Some((it.next().unwrap(), it.next().unwrap())))
}

/// Validates a vote-submitted card id is real and eligible for the scope.
pub async fn card_eligible(
    pool: &SqlitePool,
    game: &str,
    fmt: &str,
    card_id: &str,
) -> anyhow::Result<bool> {
    let found: Option<(i64,)> = match game {
        "mtg" => {
            let patterns = mtg_legality_patterns(fmt);
            let sql = format!(
                "SELECT 1 FROM cards
                 WHERE name = ? AND image IS NOT NULL AND TRIM(image) != ''
                   AND {LEGALITY_OR_CLAUSE}
                 LIMIT 1"
            );
            let mut query = sqlx::query_as(&sql).bind(card_id);
            for p in &patterns {
                query = query.bind(p.clone());
            }
            query.fetch_optional(pool).await?
        }
        "riftbound" => {
            sqlx::query_as(
                "SELECT 1 FROM rb_cards
                 WHERE id = ? AND COALESCE(image_medium, image) IS NOT NULL
                 LIMIT 1",
            )
            .bind(card_id)
            .fetch_optional(pool)
            .await?
        }
        _ => None,
    };
    Ok(found.is_some())
}

async fn read_elo_tx(
    tx: &mut Transaction<'_, Sqlite>,
    game: &str,
    fmt: &str,
    card_id: &str,
) -> anyhow::Result<f64> {
    let row = sqlx::query_as::<_, (f64,)>(
        "SELECT elo FROM card_elo WHERE game = ? AND format = ? AND card_id = ?",
    )
    .bind(game)
    .bind(fmt)
    .bind(card_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.map(|r| r.0).unwrap_or(DEFAULT_ELO))
}

async fn upsert_elo_tx(
    tx: &mut Transaction<'_, Sqlite>,
    game: &str,
    fmt: &str,
    card_id: &str,
    new_elo: f64,
    is_winner: bool,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO card_elo (game, format, card_id, elo, games_played, wins, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
         ON CONFLICT(game, format, card_id) DO UPDATE SET
             elo          = excluded.elo,
             games_played = card_elo.games_played + 1,
             wins         = card_elo.wins + excluded.wins,
             updated_at   = datetime('now')",
    )
    .bind(game)
    .bind(fmt)
    .bind(card_id)
    .bind(new_elo)
    .bind(if is_winner { 1_i64 } else { 0_i64 })
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Applies one duel result: reads both ratings (default 1500), computes new
/// ratings with standard Elo (K=32), and upserts both rows in one transaction.
pub async fn apply_vote(
    pool: &SqlitePool,
    game: &str,
    fmt: &str,
    winner_id: &str,
    loser_id: &str,
) -> anyhow::Result<EloOutcome> {
    let mut tx = pool.begin().await?;

    let rw = read_elo_tx(&mut tx, game, fmt, winner_id).await?;
    let rl = read_elo_tx(&mut tx, game, fmt, loser_id).await?;

    let e_w = 1.0 / (1.0 + 10f64.powf((rl - rw) / 400.0));
    let delta = K_FACTOR * (1.0 - e_w);
    let new_w = rw + delta;
    let new_l = rl - delta;

    upsert_elo_tx(&mut tx, game, fmt, winner_id, new_w, true).await?;
    upsert_elo_tx(&mut tx, game, fmt, loser_id, new_l, false).await?;

    tx.commit().await?;

    Ok(EloOutcome {
        winner_old: rw,
        winner_new: new_w,
        loser_old: rl,
        loser_new: new_l,
    })
}

/// Records an append-only audit row for one duel vote.
pub async fn record_vote(
    pool: &SqlitePool,
    game: &str,
    fmt: &str,
    winner_id: &str,
    loser_id: &str,
    voter_key: &str,
    user_id: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO card_duel_votes (game, format, winner_card_id, loser_card_id, voter_key, user_id)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(game)
    .bind(fmt)
    .bind(winner_id)
    .bind(loser_id)
    .bind(voter_key)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Top-N rated cards for a scope, joined back to the card name + image.
pub async fn leaderboard(
    pool: &SqlitePool,
    game: &str,
    fmt: &str,
    limit: i64,
) -> anyhow::Result<Vec<LeaderboardRow>> {
    let rows = match game {
        "mtg" => {
            sqlx::query_as::<_, LeaderboardRow>(
                "SELECT e.card_id AS name, c.image AS image, e.elo, e.games_played, e.wins
                 FROM card_elo e JOIN cards c ON c.name = e.card_id
                 WHERE e.game = 'mtg' AND e.format = ?
                 ORDER BY e.elo DESC LIMIT ?",
            )
            .bind(fmt)
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        "riftbound" => {
            sqlx::query_as::<_, LeaderboardRow>(
                "SELECT r.name AS name, COALESCE(r.image_medium, r.image) AS image,
                        e.elo, e.games_played, e.wins
                 FROM card_elo e JOIN rb_cards r ON r.id = e.card_id
                 WHERE e.game = 'riftbound' AND e.format = 'all'
                 ORDER BY e.elo DESC LIMIT ?",
            )
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        _ => Vec::new(),
    };
    Ok(rows)
}
