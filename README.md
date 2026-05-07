# TCG Web Application

A Magic: The Gathering deck builder and card browser. Rust/Axum backend, React/TypeScript frontend, SQLite database.

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

- **Card search** — search by name, semicolon-separated for multiple (`sol ring;mana crypt`), hover to preview card image
- **Deck builder** — build decks in-browser across all major formats
- **Visual stack** — cards grouped by type (Creature, Instant, Sorcery, Artifact, Enchantment, Planeswalker, Land) with stacked image view
- **Deck persistence** — save and load decks to/from the database via `.txt` file upload
- **Commander support** — commander selected separately, displayed with distinct styling
- **Deck stats** — land count, permanent count, percentages
- **Auth** — register/login with JWT

### Supported Formats

Commander · Standard · Modern · Pioneer · Legacy · Vintage · Pauper · Brawl · Historic · Alchemy

---

## API Endpoints

Base URL: `http://localhost:8080/api`

### Cards

| Method | Endpoint | Description |
|---|---|---|
| GET | `/cards` | List all cards |
| GET | `/cards?name={query}` | Search by name (`;` for multiple) |
| GET | `/cards/{name}` | Get card by exact name |
| POST | `/cards` | Create card |
| PUT | `/cards/{name}` | Update card |
| DELETE | `/cards/{name}` | Delete card |

### Decks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/list_decks` | List all saved decks |
| GET | `/load_deck?deck_name={name}` | Load a deck by name |
| POST | `/upload_deck` | Parse a deck file (multipart) |
| POST | `/save_deck` | Parse and save a deck file (multipart) |

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register a new user |
| POST | `/login` | Login → `{ "access_token": "..." }` |
| GET | `/whoami` | Return current user (requires `Authorization: Bearer <token>`) |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Returns `ok` — for load balancer / container health checks |

---

## Project Structure

```
tcg-website/
├── backend-rust/
│   ├── src/
│   │   ├── main.rs          # Server setup, CORS, router
│   │   ├── routes/          # cards.rs, decks.rs, auth.rs
│   │   ├── models/          # Card, Deck, User structs
│   │   └── db/              # SQLx query functions
│   ├── Cargo.toml
│   └── Dockerfile
│
├── frontend/
│   └── src/
│       ├── api.tsx           # Axios client + Card/Deck types
│       ├── App.tsx           # Router
│       ├── pages/            # HomePage, CreateDeckPage, LoadDeckPage, TestPage
│       └── components/       # FindCard, FoundCardsComponent, visualStack, DeckStats, ...
│
├── database/
│   └── mtg_card_db.db        # SQLite — cards (34k+), decks, users
│
└── Diagrams/                 # Architecture and UI diagrams
```

---

## Deck File Format

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
- API base URL is set in `frontend/src/api.tsx`

**Cards not loading**
- Verify the database file exists at `database/mtg_card_db.db`
- Check browser console for API errors

---

## License

Magic: The Gathering is a trademark of Wizards of the Coast.
