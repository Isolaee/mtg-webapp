# Backend README

# MTG Web Application Backend

This is the backend component of the MTG Web Application, which serves as a RESTful API for managing Magic: The Gathering card data and decks.

## Project Structure

- **app.py**: The entry point of the backend application. Initializes the Flask app, sets up the database connection, and registers the API routes.
- **db/**: Contains database-related files.
  - **__init__.py**: Initializes the database module.
  - **models.py**: Defines the database models using an ORM (like SQLAlchemy).
- **api/**: Contains API-related files.
  - **__init__.py**: Initializes the API module.
  - **routes.py**: Defines the REST API routes and handles incoming requests.
- **requirements.txt**: Lists the dependencies required for the backend application.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd mtg-webapp/backend
   ```

2. Install the required packages:
   ```
   pip install -r requirements.txt
   ```

## Running the Application

To run the backend application, execute the following command:
```
python app.py
```

The server will start on `http://localhost:5000` by default.

## API Endpoints

- **GET /api/cards**: Retrieve a list of cards.
- **GET /api/cards/<id>**: Retrieve a specific card by ID.
- **POST /api/cards**: Add a new card to the database.
- **PUT /api/cards/<id>**: Update an existing card.
- **DELETE /api/cards/<id>**: Delete a card from the database.

## Database

The backend uses SQLite as the database. The database file is located in the `database/` directory.
