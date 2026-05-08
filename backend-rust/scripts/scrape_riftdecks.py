#!/usr/bin/env python3
"""
Scrape riftdecks.com tournament results using Playwright (bypasses Cloudflare).
Outputs JSON array of events to stdout.

Strategy: each event page is scraped in a fresh browser context (Cloudflare
allows exactly one navigation per fresh context). Deck pages are NOT visited —
the deck name/champion is extracted from the event page's placement table, and
the deck URL is stored as `record` so the frontend can link out.
"""
import json
import re
import sys
from playwright.sync_api import sync_playwright, Page

BASE_URL = "https://riftdecks.com"
LISTING_URL = "https://riftdecks.com/riftbound-tournaments"
MAX_EVENTS = 10


def extract_event_id(url: str) -> str:
    parts = url.rstrip("/").rsplit("-", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[1]
    return ""


def parse_placement(text: str):
    mapping = {"1st": 1, "2nd": 2, "3rd": 3, "Top4": 4, "Top8": 8, "Top16": 16, "Top32": 32}
    return mapping.get(text)


def scrape_event(browser, url: str) -> dict | None:
    external_id = extract_event_id(url)
    if not external_id:
        return None

    ctx = browser.new_context()
    page = ctx.new_page()
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_selector("h1.page-title", timeout=20000)

        data = page.evaluate("""() => {
            const name = document.querySelector('h1.page-title')?.textContent?.trim() || '';
            const fmt = document.querySelector('.bg-pink-lt.text-pink.badge')?.textContent?.trim() || null;
            const meta = document.querySelector("meta[name='description']")?.content || '';
            const dateMatch = meta.match(/took place on (\\d{4}-\\d{2}-\\d{2})/);
            const event_date = dateMatch ? dateMatch[1] : null;

            const rows = Array.from(document.querySelectorAll(
                '#decksTable .d-none.d-md-block table tbody tr[data-href]'
            ));
            const placements = rows.map(row => ({
                deck_href: row.getAttribute('data-href') || '',
                rank: row.querySelector('td.deck-rank .text-theme-light strong')?.textContent?.trim() || '',
                player_raw: row.querySelector('td.deck-name .small.text-secondary')?.textContent?.trim() || '',
                deck_name: row.querySelector('td.deck-name .text-truncate a')?.textContent?.trim() || '',
                legend: row.querySelector('td.deck-legend-image span[title]')?.getAttribute('title') || '',
            }));
            return {name, fmt, event_date, placements};
        }""")

        name = data["name"] or f"Event {external_id}"
        fmt = data["fmt"]
        event_date = data["event_date"]

        placements = []
        for row in data["placements"]:
            deck_href = row["deck_href"]
            deck_url = (deck_href if deck_href.startswith("http") else BASE_URL + deck_href) if deck_href else None

            placement_num = parse_placement(row["rank"])
            player_raw = row["player_raw"].strip()
            player = player_raw.removeprefix("by ").strip() or None

            # Store deck_url as the record so the frontend can link out.
            # card_type='deck_url' signals to the frontend this is a link, not a card.
            decklist = []
            if deck_url:
                decklist = [{"name": row["deck_name"] or "View deck", "qty": 1, "card_type": "deck_url",
                             "deck_url": deck_url, "legend": row["legend"]}]

            placements.append({
                "placement": placement_num,
                "player": player,
                "record": deck_url,  # store deck URL for click-through
                "decklist": decklist,
            })

        return {
            "source": "riftdecks",
            "external_id": external_id,
            "name": name,
            "game": "riftbound",
            "format": fmt,
            "event_date": event_date,
            "placements": placements,
        }
    except Exception as e:
        print(f"[error] {url}: {e}", file=sys.stderr)
        return None
    finally:
        ctx.close()


def main():
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)

        # Collect event links in a dedicated context.
        list_ctx = browser.new_context()
        list_page = list_ctx.new_page()
        try:
            list_page.goto(LISTING_URL, wait_until="domcontentloaded", timeout=30000)
            list_page.wait_for_selector("a[href*='/riftbound-tournaments/']", timeout=15000)
        except Exception as e:
            print(f"[error] listing page failed: {e}", file=sys.stderr)
            list_ctx.close()
            browser.close()
            sys.exit(1)

        links = list_page.evaluate("""() =>
            [...new Set(
                Array.from(document.querySelectorAll('a[href]'))
                    .map(a => a.href)
                    .filter(h => h.includes('/riftbound-tournaments/')
                              && !h.endsWith('/riftbound-tournaments/')
                              && !h.includes('#')
                              && !h.includes('?'))
            )]
        """)
        list_ctx.close()

        print(f"[info] found {len(links)} events, scraping up to {MAX_EVENTS}", file=sys.stderr)

        events = []
        for url in links[:MAX_EVENTS]:
            ev = scrape_event(browser, url)
            if ev:
                events.append(ev)
                print(f"[ok] {ev['name']} ({len(ev['placements'])} placements)", file=sys.stderr)

        browser.close()

    print(json.dumps(events))


if __name__ == "__main__":
    main()
