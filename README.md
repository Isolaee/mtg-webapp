# TCG Web Application

A multi-game TCG platform. Supports **Magic: The Gathering** (deck builder, card browser, collection tracker) and **Riftbound** (card browser, deck storage, collection tracker). Rust/Axum backend, React/TypeScript frontend, SQLite database, Android app via Capacitor.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Axum (Rust), SQLx, tower-http |
| Frontend | React 19, TypeScript, Axios, React Router |
| Database | SQLite (`database/mtg_card_db.db`) |
| Auth | JWT (Bearer token) |
| Container | Docker — distroless runtime image |

---

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js 18+](https://nodejs.org/)
- [cargo-watch](https://crates.io/crates/cargo-watch) *(optional, for hot reload)*

### Backend

```sh
cd backend-rust
DATABASE_URL="sqlite:../database/mtg_card_db.db" cargo run
# → listening on 0.0.0.0:8080
```

Hot reload during development:
```sh
DATABASE_URL="sqlite:../database/mtg_card_db.db" cargo watch -x run
```

### Frontend

```sh
cd frontend
npm install
npm start
# → http://localhost:3000
```

### Android App (Capacitor)

Prerequisites: [Android Studio](https://developer.android.com/studio) with SDK + Java 17+

```sh
cd frontend
npm run build              # build React app
npx cap sync android       # copy build into Android project
npx cap open android       # open Android Studio → Build → Build APK(s)
```

Run directly on a connected device or emulator:
```sh
npx cap run android
```

**Important:** Edit `frontend/.env.production` and set `REACT_APP_API_URL` to your deployed server address before building for Android. The Android app cannot connect to `localhost`.

### Seed Riftbound cards

Fetches all cards from the RiftScribe API and upserts them into `rb_cards`. Safe to re-run.

```sh
cd backend-rust
DATABASE_URL="sqlite:../database/mtg_card_db.db" cargo run --bin seed_riftbound
```

### Pre-compute card image hashes (for card scanning)

Downloads card art and computes 64-bit DCT perceptual hashes for the `card_hashes` table. Required for the mobile camera scan feature. Downloads ~35k MTG + 950 Riftbound images with 20 concurrent connections; takes a few minutes. Safe to re-run — skips already-hashed cards.

```sh
cd backend-rust
DATABASE_URL="sqlite:../database/mtg_card_db.db" cargo run --bin hash_cards
```

### Docker

```sh
docker build -t tcg-backend ./backend-rust
docker run -p 8080:8080 \
  -v $(pwd)/database:/data \
  -e DATABASE_URL=sqlite:/data/mtg_card_db.db \
  tcg-backend
```

---

## Features

### Magic: The Gathering
- **Card search** — search by name, semicolon-separated for multiple (`sol ring;mana crypt`), hover to preview card image
- **Deck builder** — build decks across all major formats
- **Visual stack** — cards grouped by type with stacked image view
- **Deck persistence** — save and load decks via `.txt` file upload
- **Commander support** — commander selected separately
- **Deck stats** — land count, permanent count, percentages
- **Collection tracker** — log owned cards with quantity and foil flag; scan physical cards with the Android camera
- **Auth** — register/login with JWT

#### Supported MTG Formats
Commander · Standard · Modern · Pioneer · Legacy · Vintage · Pauper · Brawl · Historic · Alchemy

### Riftbound
- **Card browser** — filter by name, faction, type, rarity, set; hover to preview card image
- **Deck storage** — save and load decks (champion + main deck + rune deck + battlefields)
- **Collection tracker** — same as MTG: quantity, foil flag, camera scan on Android
- **950 cards** across sets OGN, OGS, SFD, UNL (seeded from RiftScribe API)

### Card Collection (both games)
- **Web UI** — search for a card by name, add with quantity and foil flag, adjust counts with +/−
- **Mobile camera scan** — live viewfinder streams rear camera, auto-scans every 1.8 s via perceptual image hashing (DCT pHash), shows top-3 matches with confidence; foil override checkbox since camera can't detect foiling

#### Riftbound Card Types
Unit · Spell · Gear · Rune · Legend · Battlefield

#### Riftbound Factions
Body · Calm · Chaos · Colorless · Fury · Mind · Order

---

## API Endpoints

Base URL: `http://localhost:8080/api`

### MTG Cards

| Method | Endpoint | Description |
|---|---|---|
| GET | `/cards` | List all cards |
| GET | `/cards?name={query}` | Search by name (`;` for multiple) |
| GET | `/cards/{name}` | Get card by exact name |
| POST | `/cards` | Create card |
| PUT | `/cards/{name}` | Update card |
| DELETE | `/cards/{name}` | Delete card |

### MTG Decks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/decks` | List all saved decks (auth required) |
| GET | `/decks/{name}` | Load a deck by name (auth required) |
| POST | `/decks` | Save a deck as JSON (auth required) |
| DELETE | `/decks/{name}` | Delete a deck (auth required) |
| POST | `/upload_deck` | Parse a deck `.txt` file — returns card list, does not save |

### Riftbound Cards

| Method | Endpoint | Description |
|---|---|---|
| GET | `/rb/cards` | List/search cards (`?name=`, `?faction=`, `?type=`, `?rarity=`, `?set=`) |
| GET | `/rb/cards/{id}` | Get card by id (e.g. `ogn-001-298`) |
| POST | `/rb/cards` | Create/upsert card |
| PUT | `/rb/cards/{id}` | Update card |
| DELETE | `/rb/cards/{id}` | Delete card |

### Riftbound Decks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/rb/decks` | List all decks |
| GET | `/rb/decks/{name}` | Get deck by name |
| POST | `/rb/decks` | Save deck (JSON body) |
| DELETE | `/rb/decks/{name}` | Delete deck |

### Collection

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/collection` | List owned cards (`?game=mtg\|riftbound` optional filter) |
| POST | `/collection` | Add card `{ game, card_id, is_foil? }` — increments quantity if same card+foil already exists |
| PUT | `/collection/{id}` | Update `{ quantity?, is_foil? }` |
| DELETE | `/collection/{id}` | Remove entry |
| POST | `/collection/scan` | Upload card image (`multipart/form-data`, field `image`) → returns top-3 pHash matches |

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register a new user |
| POST | `/login` | Login → `{ "access_token": "..." }` |
| GET | `/whoami` | Return current user (requires `Authorization: Bearer <token>`) |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Returns `ok` |

---

## Project Structure

```
tcg-website/
├── backend-rust/
│   ├── src/
│   │   ├── lib.rs           # Re-exports db/models/routes for shared use
│   │   ├── main.rs          # Server setup, CORS, router
│   │   ├── bin/
│   │   │   ├── seed_riftbound.rs  # One-shot Riftbound card importer
│   │   │   └── hash_cards.rs      # Pre-compute pHash for all card images
│   │   ├── phash.rs         # Shared DCT perceptual hash (used by routes + hash_cards)
│   │   ├── routes/
│   │   │   ├── cards.rs     # MTG card CRUD
│   │   │   ├── decks.rs     # MTG deck upload/save/load
│   │   │   ├── auth.rs      # Register/login/whoami
│   │   │   ├── collection.rs # /api/collection CRUD + /api/collection/scan
│   │   │   └── riftbound/   # /api/rb/cards and /api/rb/decks
│   │   ├── models/
│   │   │   ├── card.rs      # MTG Card struct
│   │   │   ├── deck.rs      # MTG Deck struct
│   │   │   ├── user.rs
│   │   │   ├── collection.rs # CollectionEntry struct
│   │   │   └── riftbound/   # RbCard, RbDeck structs
│   │   └── db/
│   │       ├── cards.rs     # MTG SQLx queries
│   │       ├── decks.rs
│   │       ├── users.rs
│   │       ├── collection.rs # collection + card_hashes queries + ensure_tables
│   │       └── riftbound/   # rb_cards/rb_decks queries + auto-migration
│   ├── Cargo.toml
│   └── Dockerfile
│
├── frontend/
│   └── src/
│       ├── api.tsx           # Axios client — MTG + Riftbound types and calls
│       ├── App.tsx           # Router + layout wrapper
│       ├── components/
│       │   ├── Nav.tsx       # Game switcher + per-game sub-nav
│       │   └── ...           # FindCard, FoundCardsComponent, visualStack, DeckStats
│       └── pages/
│           ├── HomePage.tsx            # Landing page
│           ├── LoginPage.tsx           # Auth (login/register)
│           ├── MyDecksPage.tsx         # Saved decks list (MTG + Riftbound)
│           ├── ProfilePage.tsx         # User profile + password change
│           ├── mtg/
│           │   ├── CardBrowserPage.tsx # MTG card search + preview
│           │   └── DeckBuilderPage.tsx # MTG deck builder + save/load
│           ├── CollectionPage.tsx      # Collection list + add card (web)
│           ├── CollectionScanPage.tsx  # Live camera scanner (Android)
│           └── riftbound/
│               ├── CardBrowserPage.tsx # Riftbound card search + preview
│               └── DeckBuilderPage.tsx # Riftbound deck builder + save/load
│
└── database/
    └── mtg_card_db.db   # SQLite — cards (34k+ MTG), decks, users, rb_cards (950), rb_decks,
                         #          collection, card_hashes
```

---

## Riftbound Deck Format (POST /api/rb/decks)

```json
{
  "name": "My Deck",
  "format": "standard",
  "champion": "ogn-001-298",
  "main_deck": [{ "id": "ogn-001-298", "count": 3 }],
  "rune_deck": [{ "id": "ogn-xxx-yyy", "count": 1 }],
  "battlefields": [],
  "description": "Optional description"
}
```

## MTG Deck File Format

Upload `.txt` files with one card per line:

```
1 Sol Ring
4 Lightning Bolt
1x Kodama of the East Tree
```

---

## Troubleshooting

**Backend won't start**
- Check `DATABASE_URL` points to a valid SQLite file
- Ensure port 8080 is free: `lsof -i:8080`

**Frontend won't connect**
- Confirm backend is running on port 8080
- API base URL is set via `REACT_APP_API_URL` env var (see `frontend/.env.development`)

**Riftbound cards missing**
- Run `cargo run --bin seed_riftbound` to import from RiftScribe

**Card scan returns no matches / weak matches**
- The `card_hashes` table may be empty — run `cargo run --bin hash_cards` to populate it
- Ensure the card art fills the viewfinder frame and lighting is even

---

## License

Magic: The Gathering is a trademark of Wizards of the Coast. Riftbound is a trademark of Riot Games.
