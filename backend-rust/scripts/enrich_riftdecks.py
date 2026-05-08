#!/usr/bin/env python3
"""
Enrich stored Riftdecks tournament placements by scraping individual deck pages
to get full card lists.

Outputs a JSON array of {id, decklist} objects to stdout, where id is the
tournament_placements row id and decklist is a JSON string of DeckEntry[].

Strategy: one fresh Playwright browser context per deck URL (same as
scrape_riftdecks.py) to avoid Cloudflare rate-limiting.

Usage:
    python3 enrich_riftdecks.py [--db PATH] [--delay MS]
"""
import json
import sqlite3
import sys
import time
import argparse
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[]")
    print("[error] playwright not installed — run: pip install playwright && playwright install firefox", file=sys.stderr)
    sys.exit(0)


DEFAULT_DB = Path(__file__).parent.parent.parent / "database" / "mtg_card_db.db"
DELAY_MS = 1500  # ms between deck page requests


def find_db() -> Path:
    # Try CWD-relative first (when run from backend-rust/), then default
    candidates = [
        Path("../database/mtg_card_db.db"),
        DEFAULT_DB,
    ]
    for p in candidates:
        if p.exists():
            return p
    return DEFAULT_DB


def load_placements_needing_enrichment(db_path: Path) -> list[dict]:
    """Return list of {id, deck_url} for placements that have deck_url entries."""
    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            """
            SELECT tp.id, tp.decklist
            FROM tournament_placements tp
            JOIN tournament_events te ON tp.event_id = te.id
            WHERE te.game = 'riftbound'
              AND tp.decklist LIKE '%"deck_url"%'
            """
        ).fetchall()
    finally:
        conn.close()

    result = []
    for row_id, decklist_json in rows:
        try:
            entries = json.loads(decklist_json or "[]")
        except json.JSONDecodeError:
            continue
        deck_url = None
        for entry in entries:
            if entry.get("card_type") == "deck_url":
                deck_url = entry.get("deck_url") or entry.get("record")
                break
        if deck_url:
            result.append({"id": row_id, "deck_url": deck_url, "original_decklist": entries})
    return result


def scrape_deck_page(browser, url: str) -> list[dict] | None:
    """
    Visit a single Riftdecks deck page and extract the card list.
    Returns list of {name, qty, card_type: "main"} or None on failure.
    """
    ctx = browser.new_context()
    page = ctx.new_page()
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # Wait for card list to appear — try multiple selectors
        try:
            page.wait_for_selector(
                ".card-list, .deck-cards, [class*='card-row'], table tbody tr",
                timeout=15000
            )
        except Exception:
            print(f"[warn] timed out waiting for cards on {url}", file=sys.stderr)
            return None

        cards = page.evaluate("""() => {
            const results = [];

            // Strategy 1: look for qty + name pairs in table rows
            const rows = document.querySelectorAll('table tbody tr');
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const maybeQty = cells[0].textContent.trim().replace('x', '').trim();
                    const maybeName = cells[1].textContent.trim();
                    const qty = parseInt(maybeQty, 10);
                    if (!isNaN(qty) && qty > 0 && maybeName.length > 1) {
                        results.push({name: maybeName, qty, card_type: 'main'});
                    }
                }
            }
            if (results.length > 0) return results;

            // Strategy 2: look for common riftdecks card list patterns
            // e.g. ".card-quantity" + ".card-name" sibling elements
            const cardRows = document.querySelectorAll('[class*="card"]');
            for (const el of cardRows) {
                const qtyEl = el.querySelector('[class*="qty"], [class*="quantity"], [class*="count"]');
                const nameEl = el.querySelector('[class*="name"], a');
                if (qtyEl && nameEl) {
                    const qty = parseInt(qtyEl.textContent.trim(), 10);
                    const name = nameEl.textContent.trim();
                    if (!isNaN(qty) && qty > 0 && name.length > 1) {
                        results.push({name, qty, card_type: 'main'});
                    }
                }
            }
            if (results.length > 0) return results;

            // Strategy 3: extract from text blocks like "3x Card Name"
            const body = document.body.innerText;
            const matches = body.matchAll(/\\b(\\d+)x?\\s+([A-Z][\\w',\\- ]{2,40})/g);
            for (const m of matches) {
                const qty = parseInt(m[1], 10);
                const name = m[2].trim();
                if (qty >= 1 && qty <= 4 && name.length > 2) {
                    results.push({name, qty, card_type: 'main'});
                }
            }
            return results;
        }""")

        if not cards:
            print(f"[warn] no cards found on {url}", file=sys.stderr)
            return None

        # Deduplicate by name (in case multiple strategies fired)
        seen = {}
        deduped = []
        for c in cards:
            if c["name"] not in seen:
                seen[c["name"]] = True
                deduped.append(c)

        return deduped

    except Exception as e:
        print(f"[error] failed to scrape {url}: {e}", file=sys.stderr)
        return None
    finally:
        ctx.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=None, help="Path to SQLite database")
    parser.add_argument("--delay", type=int, default=DELAY_MS, help="Delay between requests (ms)")
    args = parser.parse_args()

    db_path = args.db or find_db()
    delay_s = args.delay / 1000.0

    placements = load_placements_needing_enrichment(db_path)
    if not placements:
        print("[]")
        print("[info] no placements need enrichment", file=sys.stderr)
        return

    print(f"[info] enriching {len(placements)} placements", file=sys.stderr)

    enriched = []
    with sync_playwright() as p:
        browser = p.firefox.launch(headless=True)
        for i, placement in enumerate(placements):
            if i > 0:
                time.sleep(delay_s)

            url = placement["deck_url"]
            print(f"[info] scraping {i+1}/{len(placements)}: {url}", file=sys.stderr)

            cards = scrape_deck_page(browser, url)
            if cards:
                enriched.append({
                    "id": placement["id"],
                    "decklist": json.dumps(cards),
                })
                print(f"[info] found {len(cards)} cards", file=sys.stderr)
            else:
                # Preserve original deck_url entry — no enrichment
                print(f"[warn] skipping placement {placement['id']} — no cards found", file=sys.stderr)

        browser.close()

    print(json.dumps(enriched))


if __name__ == "__main__":
    main()
