use super::ScrapedEvent;

/// Scrape MTGO weekly decklists.
///
/// The MTGO decklists page (www.mtgo.com/decklists) is a React SPA that calls
/// a backend JSON API. The exact endpoint URL must be discovered by loading the
/// page in a browser and inspecting the Network tab (XHR/Fetch requests).
///
/// Once discovered, replace the stub below with:
///   1. GET the API endpoint with format/date query params
///   2. Deserialize the JSON response into ScrapedEvent structs
///   3. Return the events
pub async fn scrape(_client: &reqwest::Client) -> anyhow::Result<Vec<ScrapedEvent>> {
    // TODO: discover MTGO JSON API endpoint via browser Network tab at
    // www.mtgo.com/decklists, then implement parsing here.
    tracing::debug!("MTGO scraper: endpoint TBD, skipping");
    Ok(vec![])
}
