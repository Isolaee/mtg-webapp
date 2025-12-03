# Magic: The Gathering Web Application

A modern three-layer web application for managing Magic: The Gathering cards and decks. Built with Flask (Python) backend, React (TypeScript) frontend, and SQLite database.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Components](#components)
- [Contributing](#contributing)

---

## Features

### Card Search

- Search cards by name (supports multiple names with semicolon separator)
- Display card images on hover
- Add cards to deck with a single click

### Deck Building

- Support for multiple MTG formats:
  - Commander/EDH
  - Standard
  - Modern
  - Pioneer
  - Legacy
  - Vintage
  - Pauper
  - Brawl
  - Historic
  - Alchemy
- Commander selection for Commander format
- Track card counts (multiple copies)
- Remove cards from deck
- Save decks to database
- Load decks from database

### Visual Stack

- Interactive card visualization grouped by type:
  - Creatures, Instants, Sorceries, Artifacts, Enchantments, Planeswalkers, Lands
- Click cards to bring them forward (z-index highlight)
- Shows card count badges for multiple copies
- Commander card displayed separately with special styling

### Deck Statistics

- Land count and percentage
- Permanent count and percentage
- Total card count

### User Authentication

- User registration and login
- JWT-based authentication

---

## Project Structure

```
mtg-webapp/
├── backend/
│   ├── app.py                    # Flask application entry point
│   ├── requirements.txt          # Python dependencies
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py             # REST API endpoints
│   ├── db/
│   │   ├── __init__.py           # Database initialization
│   │   └── models.py             # SQLAlchemy models (Card, Deck, User)
│   ├── cardMixins/
│   │   └── MTGCard.py            # MTG card mixin class
│   ├── dataMethods/
│   │   ├── DBService.py          # Database query service
│   │   ├── DeckService.py        # Deck parsing and creation
│   │   ├── MTGDeck.py            # Base deck class
│   │   ├── EDHDeck.py            # Commander deck class
│   │   └── PioneerDeck.py        # Pioneer deck class
│   └── tests/
│       └── test_routes.py        # API tests
│
├── frontend/
│   ├── package.json              # Node.js dependencies
│   ├── tsconfig.json             # TypeScript configuration
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── api.tsx               # API client (Axios)
│       ├── App.tsx               # Main app with routing
│       ├── index.tsx             # Entry point
│       ├── pages/
│       │   ├── HomePage.tsx      # Home page
│       │   ├── CreateDeckPage.tsx # Deck builder
│       │   ├── LoadDeckPage.tsx  # Load existing decks
│       │   └── TestPage.tsx      # Card search test page
│       ├── components/
│       │   ├── FindCard.tsx          # Card search form
│       │   ├── FoundCardsComponent.tsx # Search results with hover preview
│       │   ├── visualStack.tsx       # Visual deck stack
│       │   ├── DeckStats.tsx         # Deck statistics
│       │   ├── FormatSelection.tsx   # Format dropdown
│       │   ├── LoadDeckForm.tsx      # Deck loading form
│       │   └── ErrorBoundary.tsx     # Error handling
│       └── context/
│           └── AuthContext.tsx   # Authentication context
│
├── database/
│   └── mtg_card_db.db            # SQLite database
│
└── Diagrams/                     # Architecture diagrams
```

---

## Architecture

```
┌─────────────────┐     HTTP      ┌─────────────────┐     SQL      ┌─────────────────┐
│                 │    Requests   │                 │   Queries    │                 │
│    Frontend     │ ────────────► │     Backend     │ ───────────► │    Database     │
│  (React + TS)   │ ◄──────────── │    (Flask)      │ ◄─────────── │    (SQLite)     │
│   Port 3000     │     JSON      │   Port 5000     │    Results   │  mtg_card_db.db │
└─────────────────┘               └─────────────────┘              └─────────────────┘
```

### Frontend (React + TypeScript)

- **State Management**: React useState hooks
- **HTTP Client**: Axios via `api.tsx`
- **Routing**: React Router DOM
- **Styling**: Inline styles

### Backend (Flask + Python)

- **Framework**: Flask with CORS support
- **Authentication**: Flask-JWT-Extended
- **ORM**: Flask-SQLAlchemy
- **API**: RESTful JSON endpoints

### Database (SQLite)

- **Cards**: MTG card data with all properties
- **Decks**: User-created decks stored as JSON
- **Users**: User accounts with hashed passwords

---

## Getting Started

### Prerequisites

- **Python 3.8+** - [Download Python](https://www.python.org/downloads/)
- **Node.js 16+** - [Download Node.js](https://nodejs.org/)
- **npm** (comes with Node.js)

### Backend Setup

1. **Navigate to backend directory:**

   ```sh
   cd backend
   ```

2. **Create virtual environment (recommended):**

   ```sh
   python -m venv venv
   venv\Scripts\activate   # Windows
   # or
   source venv/bin/activate  # macOS/Linux
   ```

3. **Install dependencies:**

   ```sh
   pip install -r requirements.txt
   ```

4. **Start the server:**

   ```sh
   python app.py
   ```

   The backend will run on `http://localhost:5000`

### Frontend Setup

1. **Open a new terminal and navigate to frontend directory:**

   ```sh
   cd frontend
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Start the development server:**

   ```sh
   npm start
   ```

   The frontend will run on `http://localhost:3000`

---

## Usage

### Creating a Deck

1. **Select Format**: Choose your MTG format from the dropdown
2. **Name Your Deck**: Enter a deck name and optional description
3. **Search for Cards**: Type a card name and click "Show Card"
4. **Add Cards to Deck**:
   - Hover over card names to preview the card image
   - Click "Add" to add a card to your deck
   - For Commander format, click "Add as Commander" to set your commander
5. **View Your Deck**:
   - See the deck list with card counts
   - View the visual stack organized by card type
   - Review deck statistics
6. **Save Your Deck**: Click "Save Deck" when finished

### Loading a Deck

1. Navigate to the **Load Deck** page
2. Select a deck from the database list
3. Or upload a deck file (.txt format)

---

## API Endpoints

### Cards

| Method | Endpoint                 | Description                                 |
| ------ | ------------------------ | ------------------------------------------- |
| GET    | `/api/cards`             | Fetch all cards                             |
| GET    | `/api/cards?name={name}` | Search cards by name (use `;` for multiple) |
| GET    | `/api/cards/{id}`        | Get a specific card                         |
| POST   | `/api/cards`             | Create a new card                           |
| PUT    | `/api/cards/{id}`        | Update a card                               |
| DELETE | `/api/cards/{id}`        | Delete a card                               |

### Decks

| Method | Endpoint                          | Description                  |
| ------ | --------------------------------- | ---------------------------- |
| GET    | `/api/list_decks`                 | Get all decks                |
| GET    | `/api/load_deck?deck_name={name}` | Load a deck by name          |
| POST   | `/api/upload_deck`                | Upload and parse a deck file |
| POST   | `/api/save_deck`                  | Save a deck to database      |

### Authentication

| Method | Endpoint        | Description                     |
| ------ | --------------- | ------------------------------- |
| POST   | `/api/register` | Register a new user             |
| POST   | `/api/login`    | Login and get JWT token         |
| GET    | `/api/whoami`   | Get current user (requires JWT) |

---

## Components

### FindCard.tsx

Card search form with loading state and error handling.

### FoundCardsComponent.tsx

Displays search results with:

- Card name list with hover image preview
- "Add" button for each card
- "Add as Commander" button (Commander format only)

### visualStack.tsx

Visual deck representation:

- Groups cards by type (Creature, Instant, etc.)
- Stacked card images with overlap
- Click to highlight/bring forward
- Badge showing card count for duplicates
- Special commander display

### DeckStats.tsx

Deck statistics showing land count, permanent count, and percentages.

### FormatSelection.tsx

Dropdown for selecting MTG format.

---

## Tools Used

- **Backend:** Flask, Flask-SQLAlchemy, Flask-CORS, Flask-JWT-Extended
- **Frontend:** React, TypeScript, Axios, React Router
- **Database:** SQLite
- **Code Quality:**
  - [Black](https://github.com/psf/black) (Python formatter)
  - [Ruff](https://github.com/charliermarsh/ruff) (Python linter)
  - [Prettier](https://github.com/prettier/prettier) (JS/TS formatter)
- **Testing:** Pytest
- **Pre-commit Hooks:** [pre-commit](https://pre-commit.com/)

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Python: Black, Ruff, Flake8
- JS/TS: Prettier

Run pre-commit hooks before committing:

```sh
pre-commit run --all-files
```

---

## Troubleshooting

### Backend won't start

- Ensure Python 3.8+ is installed: `python --version`
- Install dependencies: `pip install -r requirements.txt`
- Verify you're in the `backend` directory

### Frontend won't start

- Ensure Node.js 16+ is installed: `node --version`
- Clear and reinstall: `rm -rf node_modules && npm install`
- Check for port conflicts on 3000

### CORS errors

- Ensure the backend is running on port 5000
- Check that Flask-CORS is installed

### Cards not loading

- Verify the backend is running
- Check browser console for API errors
- Ensure the database file exists in `database/`

---

## License

This project is for educational purposes. Magic: The Gathering is a trademark of Wizards of the Coast.
