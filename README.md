# Magic: The Gathering Web Application

This project is a modern three-layer web application for managing Magic: The Gathering cards and decks. It consists of a backend server built with Flask, a frontend application built with React, and a SQLite database for data storage.

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
│   ├── requirements.txt       # Lists backend dependencies
│   └── README.md             # Documentation for the backend application
├── frontend
│   ├── public
│   │   └── index.html        # Main HTML file for the frontend application
│   ├── src
│   │   ├── App.js            # Main React component
│   │   ├── api.js            # Functions for making API calls to the backend
│   │   └── components
│   │       └── CardList.js   # Component for displaying a list of cards
│   ├── package.json          # Configuration file for npm
│   └── README.md             # Documentation for the frontend application
├── database
│   └── mtg_card_db.db        # SQLite database file for card data
└── README.md                 # Documentation for the overall project
```

## Getting Started

### Prerequisites

- Python 3.x
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

### Running the Application

1. Start the backend server:
   - Navigate to the `backend` directory and run:
     ```
     python app.py
     ```

2. Start the frontend application:
   - Navigate to the `frontend` directory and run:
     ```
     npm start
     ```

3. Open your web browser and go to `http://localhost:3000` to access the application.

## API Documentation

The backend provides a REST API for interacting with the card database. Refer to the `backend/api/routes.py` file for the available endpoints and their usage.