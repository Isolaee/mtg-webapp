# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

---

## Build & Run

### Rust Backend (`backend-rust/`)

```bash
DATABASE_URL="sqlite:../database/mtg_card_db.db" cargo run       # run on :8080
DATABASE_URL="sqlite:../database/mtg_card_db.db" cargo build
DATABASE_URL="sqlite:../database/mtg_card_db.db" cargo watch -x run  # hot reload
cargo test
cargo clippy
```

Seed Riftbound cards (re-runnable, upserts from RiftScribe API):
```bash
DATABASE_URL="sqlite:../database/mtg_card_db.db" cargo run --bin seed_riftbound
```

### React Frontend (`frontend/`)

```bash
npm install
npm start        # dev server on :3000
npm run build
npm test
```

### Android App — Capacitor (`frontend/`)

Prerequisites: [Android Studio](https://developer.android.com/studio) with SDK + Java 17+

```bash
npm run build                # build React app first (outputs to frontend/build/)
npx cap sync android         # copy build into Android project + sync plugins
npx cap open android         # open Android Studio → Build → Build APK(s)
```

Run on connected device or emulator:
```bash
npx cap run android
```

**API URL for Android build:** edit `frontend/.env.production` and set `REACT_APP_API_URL` to your deployed server address before `npm run build`. The Android app cannot reach `localhost`.

Re-run `npm run build && npx cap sync android` after every React change.

---

## Architecture

**Stack:** Axum (Rust) + React (TypeScript) + SQLite (via SQLx, runtime queries — no compile-time macros)

```
frontend/ (React + TypeScript, port 3000)
    src/api.tsx                  ← Axios client; MTG + Riftbound types and fetch fns
    src/App.tsx                  ← Router + max-width layout wrapper
    src/components/Nav.tsx       ← Game-switcher tabs + per-game sub-nav
    src/pages/                   ← HomePage (auth), CreateDeckPage, LoadDeckPage, TestPage
    src/pages/riftbound/         ← CardBrowserPage, DeckBuilderPage

backend-rust/ (Axum, port 8080)
    src/lib.rs                   ← Re-exports db/models/routes (needed by src/bin/)
    src/main.rs                  ← CORS, TraceLayer, router wiring
    src/routes/cards.rs          ← MTG /api/cards CRUD
    src/routes/decks.rs          ← MTG /api/list_decks, upload_deck, save_deck, load_deck
    src/routes/auth.rs           ← /api/register, /api/login, /api/whoami
    src/routes/riftbound/        ← /api/rb/cards and /api/rb/decks
    src/models/{card,deck,user}.rs
    src/models/riftbound/        ← RbCard, RbDeck structs
    src/db/{cards,decks,users}.rs
    src/db/riftbound/            ← rb_cards/rb_decks queries + ensure_tables (auto-runs on startup)
    src/bin/seed_riftbound.rs    ← Fetches all cards from RiftScribe API per set

database/
    mtg_card_db.db               ← SQLite: cards (34k+ MTG), decks, users, rb_cards (950), rb_decks
```

**Key data flows:**
- MTG cards: stored in SQLite from Scryfall bulk import. Searched via `LOWER(name) LIKE ?` with semicolon-separated multi-card support.
- Riftbound cards: seeded from `https://riftscribe.gg/api/cards?set_id=OGN&limit=500` etc. Fetched via `/api/rb/cards?faction=fury&type=Unit`.
- Decks (both games): stored as JSON text blobs in SQLite (`cards`/`main_deck`/`rune_deck` columns).
- Auth: JWT (24h expiry), `Authorization: Bearer <token>` header, `bcrypt` for password hashing.

---

## Conventions

- **Frontend base URL:** `frontend/src/api.tsx` — reads `REACT_APP_API_URL` env var, falls back to `http://localhost:8080/api`. Set in `.env.development` / `.env.production`.
- **SQLx pattern:** Use runtime `sqlx::query_as::<_, T>(&sql)` — NOT `query_as!` macros. The original SQLite schema has loose types requiring `CAST(cmc AS REAL)` etc. in SELECT queries.
- **Serde renames:** MTG `Card` struct uses `#[serde(rename)]` to map lowercase DB columns to camelCase JSON (`cardtype` → `cardType`, `oracletext` → `oracleText`). Keep this pattern for new MTG fields.
- **Riftbound DB columns** are snake_case and map directly (no renaming needed).
- **New Riftbound route modules** go in `src/routes/riftbound/`, registered in `src/routes/riftbound/mod.rs`, and merged in `src/routes/mod.rs`.
- **Binaries** in `src/bin/` use `use tcg_backend::...` (not `mod`) — `src/lib.rs` exports the shared modules.
- **`rb_cards`/`rb_decks` tables** are created automatically via `db::riftbound::ensure_tables` called from `db::create_pool`.
- **Riftbound card id format:** `{set}-{number}-{champion_id}`, e.g. `ogn-001-298`.
- **`GET /health`** returns `"ok"` — used by load balancers.
- **MTG formats:** commander, standard, modern, pioneer, legacy, vintage, pauper, brawl, historic, alchemy.
- **Riftbound sets:** OGN, OGS, SFD, UNL (VEN empty). Factions: body, calm, chaos, colorless, fury, mind, order.
