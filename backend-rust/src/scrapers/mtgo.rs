use super::{DeckEntry, ScrapedEvent, ScrapedPlacement};
use chrono::Datelike;
use scraper::{Html, Selector};
use serde::Deserialize;

const ROOT_URL: &str = "https://www.mtgo.com";
const LIST_URL: &str = "https://www.mtgo.com/decklists/{year}/{month}";

pub async fn scrape(client: &reqwest::Client) -> anyhow::Result<Vec<ScrapedEvent>> {
    let now = chrono::Utc::now();
    let months = [
        (now.year(), now.month()),
        {
            if now.month() == 1 {
                (now.year() - 1, 12)
            } else {
                (now.year(), now.month() - 1)
            }
        },
    ];

    let mut event_links: Vec<(String, String, String)> = Vec::new(); // (url, name, date)

    for (year, month) in months {
        let list_url = LIST_URL
            .replace("{year}", &year.to_string())
            .replace("{month}", &format!("{month:02}"));

        match fetch_event_list(client, &list_url).await {
            Ok(links) => event_links.extend(links),
            Err(e) => tracing::warn!("MTGO listing {list_url} failed: {e}"),
        }
    }

    let mut events = Vec::new();
    for (url, name, date) in &event_links {
        match fetch_event(client, url, name, date).await {
            Ok(Some(ev)) => events.push(ev),
            Ok(None) => {}
            Err(e) => tracing::warn!("MTGO event {url} failed: {e}"),
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }

    Ok(events)
}

// Returns (url, name, date_str) tuples
async fn fetch_event_list(
    client: &reqwest::Client,
    url: &str,
) -> anyhow::Result<Vec<(String, String, String)>> {
    let html = client.get(url).send().await?.text().await?;
    Ok(parse_event_list(&html))
}

fn parse_event_list(html: &str) -> Vec<(String, String, String)> {
    let doc = Html::parse_document(html);
    let item_sel = Selector::parse("li.decklists-item").unwrap();
    let link_sel = Selector::parse("a").unwrap();
    let title_sel = Selector::parse("h3").unwrap();
    let time_sel = Selector::parse("time").unwrap();

    let mut results = Vec::new();
    for item in doc.select(&item_sel) {
        let link = item.select(&link_sel).next();
        let title = item.select(&title_sel).next();
        let time = item.select(&time_sel).next();

        let (Some(link), Some(title), Some(time)) = (link, title, time) else {
            continue;
        };

        let href = link.value().attr("href").unwrap_or("");
        if href.is_empty() {
            continue;
        }
        let full_url = if href.starts_with("http") {
            href.to_string()
        } else {
            format!("{ROOT_URL}{href}")
        };

        let name = title.text().collect::<String>().trim().to_string();
        let date = time
            .value()
            .attr("datetime")
            .unwrap_or("")
            .chars()
            .take(10)
            .collect::<String>();

        results.push((full_url, name, date));
    }
    results
}

async fn fetch_event(
    client: &reqwest::Client,
    url: &str,
    name: &str,
    date: &str,
) -> anyhow::Result<Option<ScrapedEvent>> {
    let html = client.get(url).send().await?.text().await?;

    let Some(json_str) = extract_data_json(&html) else {
        tracing::debug!("MTGO: no data JSON in {url}");
        return Ok(None);
    };

    let data: EventData = serde_json::from_str(&json_str)
        .map_err(|e| anyhow::anyhow!("MTGO JSON parse at {url}: {e}"))?;

    let external_id = url
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(url)
        .to_string();

    let format = data
        .format
        .as_deref()
        .and_then(normalize_format_code)
        .or_else(|| extract_format_from_name(name));
    let event_type = if data.starttime.is_some() {
        "tournament"
    } else {
        "league"
    };

    let placements = parse_placements(&data, event_type);

    Ok(Some(ScrapedEvent {
        source: "mtgo".to_string(),
        external_id,
        name: name.to_string(),
        game: "mtg".to_string(),
        format,
        event_date: if date.is_empty() { None } else { Some(date.to_string()) },
        placements,
    }))
}

fn extract_data_json(html: &str) -> Option<String> {
    for line in html.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("window.MTGO.decklists.data = ") {
            // Strip trailing semicolon
            let json = rest.trim_end_matches(';');
            return Some(json.to_string());
        }
    }
    None
}

fn parse_placements(data: &EventData, event_type: &str) -> Vec<ScrapedPlacement> {
    let Some(decklists) = &data.decklists else {
        return vec![];
    };

    let mut placements = Vec::new();
    let mut rank = 1i32;

    for deck in decklists {
        let mut cards: Vec<DeckEntry> = Vec::new();
        for card in &deck.main_deck {
            cards.push(DeckEntry {
                name: card.card_attributes.card_name.clone(),
                qty: card.qty.parse().unwrap_or(1),
                card_type: "main".to_string(),
            });
        }
        for card in &deck.sideboard_deck {
            cards.push(DeckEntry {
                name: card.card_attributes.card_name.clone(),
                qty: card.qty.parse().unwrap_or(1),
                card_type: "sideboard".to_string(),
            });
        }

        let record = if event_type == "league" {
            deck.wins.as_ref().map(|w| match w.wins.as_deref() {
                Some("5") => "5-0".to_string(),
                Some("4") => "4-1".to_string(),
                Some("3") => "3-2".to_string(),
                Some("2") => "2-3".to_string(),
                Some("1") => "1-4".to_string(),
                Some("0") => "0-5".to_string(),
                Some(s) => s.to_string(),
                None => String::new(),
            })
        } else {
            // Look up in winloss by loginid (both stored as strings)
            data.winloss.as_ref().and_then(|wl| {
                wl.iter()
                    .find(|w| w.loginid == deck.loginid)
                    .map(|w| format!("{}-{}", w.wins, w.losses))
            })
        };

        let placement = if event_type == "tournament" && data.winloss.is_none() {
            // Challenge: ordered by rank in the JSON
            let p = rank;
            rank += 1;
            Some(p)
        } else {
            None
        };

        placements.push(ScrapedPlacement {
            placement,
            player: Some(deck.player.clone()),
            record,
            decklist: cards,
        });
    }

    placements
}

// Maps MTGO format codes like "CSTANDARD" → "standard"
fn normalize_format_code(code: &str) -> Option<String> {
    let stripped = code.strip_prefix('C').unwrap_or(code).to_lowercase();
    match stripped.as_str() {
        "standard" | "pioneer" | "modern" | "legacy" | "vintage" | "pauper"
        | "commander" | "premodern" | "historic" => Some(stripped),
        _ => None,
    }
}

fn extract_format_from_name(name: &str) -> Option<String> {
    let lower = name.to_lowercase();
    for fmt in &[
        "standard",
        "pioneer",
        "modern",
        "legacy",
        "vintage",
        "pauper",
        "commander",
        "premodern",
        "historic",
    ] {
        if lower.contains(fmt) {
            return Some(fmt.to_string());
        }
    }
    None
}

// Serde types matching the window.MTGO.decklists.data JSON structure.
// All numeric fields arrive as JSON strings (e.g. "qty":"2").

#[derive(Deserialize)]
struct EventData {
    starttime: Option<serde_json::Value>, // present for tournaments, absent for leagues
    format: Option<String>,               // e.g. "CSTANDARD", "CMODERN"; absent on leagues
    decklists: Option<Vec<DecklistEntry>>,
    winloss: Option<Vec<WinlossEntry>>,
}

#[derive(Deserialize)]
struct DecklistEntry {
    player: String,
    loginid: String,
    main_deck: Vec<CardEntry>,
    sideboard_deck: Vec<CardEntry>,
    wins: Option<LeagueWins>, // only present on league decks
}

#[derive(Deserialize)]
struct CardEntry {
    card_attributes: CardAttributes,
    qty: String, // JSON delivers qty as a string
}

#[derive(Deserialize)]
struct CardAttributes {
    card_name: String,
}

#[derive(Deserialize)]
struct LeagueWins {
    wins: Option<String>,
}

#[derive(Deserialize)]
struct WinlossEntry {
    loginid: String,
    wins: String,   // also delivered as strings
    losses: String,
}
