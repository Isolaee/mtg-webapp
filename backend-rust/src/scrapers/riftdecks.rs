use super::{DeckEntry, ScrapedEvent, ScrapedPlacement};
use fantoccini::{Client, ClientBuilder};
use scraper::{Html, Selector};

const BASE_URL: &str = "https://riftdecks.com";
const LISTING_URL: &str = "https://riftdecks.com/riftbound-tournaments";

pub async fn scrape() -> anyhow::Result<Vec<ScrapedEvent>> {
    let client = ClientBuilder::native()
        .connect("http://localhost:4444")
        .await
        .map_err(|e| anyhow::anyhow!("chromedriver connect failed: {e}"))?;

    let result = scrape_inner(&client).await;
    let _ = client.close().await;
    result
}

async fn scrape_inner(client: &Client) -> anyhow::Result<Vec<ScrapedEvent>> {
    client.goto(LISTING_URL).await?;
    tokio::time::sleep(std::time::Duration::from_secs(3)).await;

    let html = client.source().await?;
    let event_urls = parse_event_listing(&html);

    if event_urls.is_empty() {
        tracing::warn!("riftdecks: no event links found on listing page");
    }

    let mut events = Vec::new();

    for event_url in event_urls.iter().take(10) {
        match scrape_event(client, event_url).await {
            Ok(Some(event)) => events.push(event),
            Ok(None) => {}
            Err(e) => tracing::error!("riftdecks: failed scraping {event_url}: {e}"),
        }
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }

    Ok(events)
}

fn parse_event_listing(html: &str) -> Vec<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("a[href]").unwrap();

    let mut urls: Vec<String> = Vec::new();
    for el in doc.select(&sel) {
        let href = el.value().attr("href").unwrap_or("");
        if href.contains("/riftbound-tournaments/")
            && !href.ends_with("/riftbound-tournaments/")
            && !href.contains('#')
            && !href.contains('?')
        {
            let full = if href.starts_with("http") {
                href.to_string()
            } else {
                format!("{BASE_URL}{href}")
            };
            if !urls.contains(&full) {
                urls.push(full);
            }
        }
    }
    urls
}

// Returns (external_id, name, format, event_date, placement_rows).
// placement_rows: (placement, player, deck_url)
fn parse_event_page(
    html: &str,
    url: &str,
) -> Option<(
    String,
    String,
    Option<String>,
    Option<String>,
    Vec<(Option<i32>, Option<String>, String)>,
)> {
    let external_id = extract_event_id(url);
    if external_id.is_empty() {
        return None;
    }

    let doc = Html::parse_document(html);

    let title_sel = Selector::parse("h1.page-title").unwrap();
    let name = doc
        .select(&title_sel)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .unwrap_or_else(|| format!("Event {external_id}"));

    let format = extract_format(&doc);
    let event_date = extract_event_date(&doc);
    let placement_rows = collect_placement_rows(&doc);

    Some((external_id, name, format, event_date, placement_rows))
}

// Returns Vec<DeckEntry> by parsing the deck page HTML synchronously.
fn parse_deck_page(html: &str) -> Vec<DeckEntry> {
    let doc = Html::parse_document(html);
    let row_sel = Selector::parse("#decklist tr.card-list-item").unwrap();
    let name_sel = Selector::parse("td:nth-child(3) a").unwrap();

    let mut cards = Vec::new();
    for row in doc.select(&row_sel) {
        let card_type = row
            .value()
            .attr("data-card-type")
            .unwrap_or("")
            .to_string();
        let qty: i32 = row
            .value()
            .attr("data-quantity")
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);
        let name = row
            .select(&name_sel)
            .next()
            .map(|el| el.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        if name.is_empty() || qty == 0 {
            continue;
        }
        cards.push(DeckEntry {
            name,
            qty,
            card_type,
        });
    }
    cards
}

async fn scrape_event(client: &Client, url: &str) -> anyhow::Result<Option<ScrapedEvent>> {
    client.goto(url).await?;
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    let html = client.source().await?;

    // Parse all HTML synchronously so Html (non-Send) is dropped before any await.
    let Some((external_id, name, format, event_date, placement_rows)) =
        parse_event_page(&html, url)
    else {
        return Ok(None);
    };

    let mut placements = Vec::new();
    for (placement_num, player, deck_url) in placement_rows {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        let deck_html = match fetch_deck_page(client, &deck_url).await {
            Ok(h) => h,
            Err(e) => {
                tracing::warn!("riftdecks: deck {deck_url} failed: {e}");
                String::new()
            }
        };

        let decklist = if deck_html.is_empty() {
            vec![]
        } else {
            parse_deck_page(&deck_html)
        };

        placements.push(ScrapedPlacement {
            placement: placement_num,
            player,
            record: None,
            decklist,
        });
    }

    Ok(Some(ScrapedEvent {
        source: "riftdecks".to_string(),
        external_id,
        name,
        game: "riftbound".to_string(),
        format,
        event_date,
        placements,
    }))
}

async fn fetch_deck_page(client: &Client, url: &str) -> anyhow::Result<String> {
    client.goto(url).await?;
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    Ok(client.source().await?)
}

fn extract_event_id(url: &str) -> String {
    url.trim_end_matches('/')
        .rsplit('-')
        .next()
        .filter(|s| s.chars().all(|c| c.is_ascii_digit()))
        .map(|s| s.to_string())
        .unwrap_or_default()
}

fn extract_format(doc: &Html) -> Option<String> {
    let badge_sel = Selector::parse(".bg-pink-lt.text-pink.badge").unwrap();
    doc.select(&badge_sel)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
}

fn extract_event_date(doc: &Html) -> Option<String> {
    let meta_sel = Selector::parse("meta[name='description']").unwrap();
    let content = doc
        .select(&meta_sel)
        .next()?
        .value()
        .attr("content")?
        .to_string();

    let pos = content.find("took place on ")?;
    let after = &content[pos + "took place on ".len()..];
    let date_str: String = after.chars().take(10).collect();
    if date_str.len() == 10 {
        Some(date_str)
    } else {
        None
    }
}

fn collect_placement_rows(doc: &Html) -> Vec<(Option<i32>, Option<String>, String)> {
    let row_sel = Selector::parse(
        "#decksTable .d-none.d-md-block table tbody tr[data-href]",
    )
    .unwrap();
    let rank_sel = Selector::parse("td.deck-rank .text-theme-light strong").unwrap();
    let player_sel = Selector::parse("td.deck-name .small.text-secondary").unwrap();

    let mut rows = Vec::new();
    for row in doc.select(&row_sel) {
        let deck_href = row.value().attr("data-href").unwrap_or("");
        if deck_href.is_empty() {
            continue;
        }
        let deck_url = if deck_href.starts_with("http") {
            deck_href.to_string()
        } else {
            format!("{BASE_URL}{deck_href}")
        };

        let placement_text = row
            .select(&rank_sel)
            .next()
            .map(|el| el.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        let placement_num = parse_placement(&placement_text);

        let player = row.select(&player_sel).next().map(|el| {
            let raw = el.text().collect::<String>();
            let trimmed = raw.trim();
            trimmed
                .strip_prefix("by ")
                .unwrap_or(trimmed)
                .to_string()
        });

        rows.push((placement_num, player, deck_url));
    }
    rows
}

fn parse_placement(text: &str) -> Option<i32> {
    match text {
        "1st" => Some(1),
        "2nd" => Some(2),
        "3rd" => Some(3),
        "Top4" => Some(4),
        "Top8" => Some(8),
        "Top16" => Some(16),
        "Top32" => Some(32),
        _ => None,
    }
}
