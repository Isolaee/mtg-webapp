# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

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


## Build & Run

### Rust Backend (target: `backend-rust/`)
```bash
cargo build                  # build
cargo run                    # run on :8080
cargo watch -x run           # hot reload (cargo-watch)
cargo test                   # run tests
cargo clippy                 # lint
```

### React Frontend (`frontend/`)
```bash
npm install
npm start                    # dev server on :3000
npm run build                # production build
npm test                     # run tests
```

## Architecture

**Stack:** Axum (Rust) + React (TypeScript) + SQLite (via SQLx)

```
frontend/ (React + TypeScript, port 3000)
    └── src/api.tsx          ← Axios client, all API calls go through here
    └── src/pages/           ← CreateDeck, LoadDeck, Home, Test
    └── src/components/      ← FindCard, visualStack, DeckStats, etc.
    └── src/context/AuthContext.tsx

backend-rust/ (Axum, port 8080)
    └── src/main.rs          ← router, CORS, JWT layer setup
    └── src/routes/          ← handler modules per resource
    └── src/models/          ← serde structs (Card, Deck, User)
    └── src/db/              ← SQLx pool + query functions

database/
    └── mtg_card_db.db       ← SQLite, tables: cards, decks, users
```

**Key data flow:** Frontend calls JSON REST endpoints. Card data is stored locally in SQLite (imported from Scryfall bulk data). Deck lists are stored as JSON blobs in the `decks` table. Auth uses JWT (Bearer token in Authorization header).

**Card model fields:** name (PK), manacost, cmc, colors, colorIdentity, power, toughness, oracleText, loyalty, typeline, cardType, artist, legalities, image (Scryfall URL).

**Deck model:** id, name, description, format, commander (JSON), cards (JSON array).

## Conventions

- Frontend base URL is configured in `frontend/src/api.tsx` (`API_BASE_URL`)
- Deck formats: commander, standard, modern, pioneer, legacy, vintage, pauper, brawl, historic, alchemy
- Card search supports semicolon-separated names: `/api/cards?name=sol+ring;mana+crypt`
- DB columns are lowercase (`cardtype`, `oracletext`, `coloridentity`); Rust serialises them as camelCase (`cardType`, `oracleText`, `colorIdentity`) via `#[serde(rename)]` on the `Card` struct — keep this pattern when adding fields
- `GET /health` returns `"ok"` — used by load balancers / container orchestrators
