# Magic: The Gathering Web Application

This project is a modern three-layer web application for managing Magic: The Gathering cards and decks. It consists of a backend server built with Flask, a frontend application built with React and TypeScript, and a SQLite database for data storage.

## Project Structure

```
mtg-webapp
├── backend
│   ├── app.py                # Entry point for the backend application
│   ├── db                    # Database module
│   │   ├── __init__.py       # Initializes the database module
│   │   └── models.py         # Defines database models using an ORM
│   ├── api                   # API module
│   │   ├── __init__.py       # Initializes the API module
│   │   └── routes.py         # Defines REST API routes
│   ├── requirements.txt      # Lists backend dependencies
│   └── README.md             # Documentation for the backend application
├── frontend
│   ├── public
│   │   └── index.html        # Main HTML file for the frontend application
│   ├── src
│   │   ├── App.tsx           # Main React component (TypeScript)
│   │   ├── api.tsx           # Functions for making API calls to the backend (TypeScript)
│   │   └── components
│   │       └── CardList.tsx  # Component for displaying a list of cards (TypeScript)
│   ├── package.json          # Configuration file for npm
│   └── README.md             # Documentation for the frontend application
├── database
│   └── mtg_card_db.db        # SQLite database file for card data
├── .pre-commit-config.yaml   # Pre-commit hooks configuration
└── README.md                 # Documentation for the overall project
```

## Tools Used

- **Backend:** Flask, Flask-SQLAlchemy, Flask-CORS
- **Frontend:** React, TypeScript, Axios
- **Database:** SQLite
- **Code Quality & Formatting:**
  - [Black](https://github.com/psf/black) (Python code formatter)
  - [Ruff](https://github.com/charliermarsh/ruff) (Python linter)
  - [Flake8](https://github.com/pycqa/flake8) (Python linter)
  - [Prettier](https://github.com/prettier/prettier) (JS/TS/CSS/HTML formatter)
- **Testing:** Pytest
- **Pre-commit Hooks:** [pre-commit](https://pre-commit.com/) for automated code checks and formatting

## Getting Started

### Prerequisites

- Python 3.8.x
- Node.js and npm

### Installation

1. Clone the repository:

   ```
   git clone <repository-url>
   cd mtg-webapp
   ```

2. Set up the backend:

   - Navigate to the `backend` directory.
   - Install the required Python packages:
     ```
     pip install -r requirements.txt
     ```

3. Set up the frontend:

   - Navigate to the `frontend` directory.
   - Install the required npm packages:
     ```
     npm install
     ```

4. (Optional) Set up pre-commit hooks:
   - In the project root, run:
     ```
     pip install pre-commit
     pre-commit install
     ```

### Running the Application

1. Start the backend server:

   - From the project root, run:
     ```
     python -m backend.app
     ```

2. Start the frontend application:

   - Navigate to the `frontend` directory and run:
     ```
     npm start
     ```

3. Open your web browser and go to `http://localhost:3000` to access the application.

## API Documentation

The backend provides a REST API for interacting with the card database. Refer to the `backend/api/routes.py` file for the available endpoints and their usage.

## Code Quality

This project uses pre-commit hooks to enforce code quality and formatting for both Python and JavaScript/TypeScript code.
Hooks include Black, Ruff, Flake8, Prettier, and pytest.
