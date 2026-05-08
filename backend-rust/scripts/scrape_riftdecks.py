#!/usr/bin/env python3
"""
Scrape riftdecks.com tournament results using Playwright (bypasses Cloudflare).
Outputs JSON array of events to stdout.

Each event:
  {source, external_id, name, game, format, event_date,
   placements: [{placement, player, record, decklist: [{name, qty, card_type}]}]}
"""
import json
import re
import sys
from playwright.sync_api import sync_playwright

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


def nav(page, url, selector, timeout=30000, wait_timeout=20000):
    """Navigate and wait for selector. Raise on failure."""
    page.goto(url, wait_until="domcontentloaded", timeout=timeout)
    page.wait_for_selector(selector, timeout=wait_timeout)


def scrape_deck(browser, url: str) -> list:
    """Scrape a deck page in a fresh context. Returns list of card dicts."""
    ctx = browser.new_context()
    page = ctx.new_page()
    try:
        nav(page, url, "#decklist")
        raw = page.evaluate("""() => {
            const rows = Array.from(document.querySelectorAll('#decklist tr.card-list-item'));
            return rows.map(r => ({
                card_type: r.getAttribute('data-card-type') || '',
                qty: r.getAttribute('data-quantity') || '0',
                name: r.querySelector('td:nth-child(3) a')?.textContent?.trim() || '',
            }));
        }""")
        return [
            {"name": c["name"], "qty": int(c["qty"] or 0), "card_type": c["card_type"]}
            for c in raw
            if c["name"] and int(c["qty"] or 0) > 0
        ]
    except Exception as e:
        print(f"[warn] deck {url}: {e}", file=sys.stderr)
        return []
    finally:
        ctx.close()


def scrape_event(browser, url: str):
    external_id = extract_event_id(url)
    if not external_id:
        return None

    # Fresh context per event — avoids Cloudflare state contamination from listing page.
    ctx = browser.new_context()
    page = ctx.new_page()
    try:
        nav(page, url, "h1.page-title")

        # Extract all DOM data synchronously in one JS call to avoid ElementHandle
        # invalidation from Cloudflare's internal redirects.
        event_data = page.evaluate("""() => {
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
            }));
            return {name, fmt, event_date, placements};
        }""")

        name = event_data["name"] or f"Event {external_id}"
        fmt = event_data["fmt"]
        event_date = event_data["event_date"]

        placements = []
        for row in event_data["placements"]:
            deck_href = row["deck_href"]
            if not deck_href:
                continue
            deck_url = deck_href if deck_href.startswith("http") else BASE_URL + deck_href

            placement_num = parse_placement(row["rank"])
            player_raw = row["player_raw"].strip()
            player = player_raw.removeprefix("by ").strip() or None

            decklist = scrape_deck(browser, deck_url)

            placements.append({
                "placement": placement_num,
                "player": player,
                "record": None,
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
    finally:
        ctx.close()


def main():
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)

        # Collect event links in a dedicated context.
        list_ctx = browser.new_context()
        list_page = list_ctx.new_page()
        try:
            nav(list_page, LISTING_URL, "a[href*='/riftbound-tournaments/']")
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

        events = []
        for url in links[:MAX_EVENTS]:
            try:
                ev = scrape_event(browser, url)
                if ev:
                    events.append(ev)
                    print(f"[ok] {ev['name']} ({len(ev['placements'])} placements)", file=sys.stderr)
            except Exception as e:
                print(f"[error] {url}: {e}", file=sys.stderr)

        browser.close()

    print(json.dumps(events))


if __name__ == "__main__":
    main()
