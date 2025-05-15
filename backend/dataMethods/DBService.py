import os
from .EDHDeck import EDHDeck
from .MTGCard import MTGCard
import json
import sqlite3

database_path = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "database", "mtg_card_db.db")
)


class DBService:
    """
    A class to handle database queries for Magic: The Gathering cards and decks.
    """

    @staticmethod
    def queryCardsByProperties(filters: dict) -> list:
        """
        Query the card database based on given properties and return MTGCard objects.

        Args:
            filters (dict): A dictionary of properties to filter cards by.
                            Example: {"name": "%fire%", "cmc": 3}

        Returns:
            list: A list of MTGCard objects that match the query, or an empty list if no matches are found.
        """
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()

        # Base query
        query = "SELECT * FROM cards WHERE "
        conditions = []
        values = []

        # Dynamically build the WHERE clause based on the filters
        for key, value in filters.items():
            if key == "name":
                # Use LIKE for partial matches in the name field
                conditions.append(f"{key} LIKE ?")
            else:
                # Use = for exact matches
                conditions.append(f"{key} = ?")
            values.append(value)

        # Combine conditions into the query
        query += " AND ".join(conditions)

        try:
            # Execute the query
            cursor.execute(query, values)
            rows = cursor.fetchall()
            if rows:
                return [
                    MTGCard(
                        name=row[0],
                        manacost=row[1],
                        cmc=row[2],
                        colors=json.loads(row[3]),  # Convert JSON string back to list
                        colorIdentity=json.loads(
                            row[4]
                        ),  # Convert JSON string back to list
                        power=row[5],
                        toughness=row[6],
                        oracleText=row[7],
                        loyalty=row[8],
                        typeline=row[9],
                        cardType=row[10],
                        cardFaces=json.loads(
                            row[11]
                        ),  # Convert JSON string back to list
                        allParts=json.loads(
                            row[12]
                        ),  # Convert JSON string back to list
                        layout=row[13],
                        artist=row[14],
                        scryfallid=None,  # Not stored in the database, set to None or add it to the schema
                        legalities=json.loads(
                            row[15]
                        ),  # Convert JSON string back to dict
                        image=row[16],
                    )
                    for row in rows
                ]
            else:
                return []
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return []
        finally:
            conn.close()

    def saveDeckToDB(deck) -> None:
        """
        Save the deck to the database.
        """
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()

        format = deck.getFormat()
        cards_json = json.dumps([card.to_dict() for card in deck.cards])

        if not deck.enforceFormatRules():
            return

        if format == "commander":
            # Create the table if it doesn't exist
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS decks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    format TEXT NOT NULL,
                    commander TEXT NOT NULL,
                    cards TEXT NOT NULL
                )
                """
            )
            # Serialize the commander and cards as JSON
            commander_json = (
                json.dumps(deck.getCommander().to_dict())
                if deck.getCommander()
                else None
            )

            # Insert the deck into the database
            cursor.execute(
                """
                INSERT INTO decks (name, format, commander, cards)
                VALUES (?, ?, ?, ?)
                """,
                (deck.name, deck.format, commander_json, cards_json),
            )

            # Commit the changes and close the connection
            conn.commit()

        elif format == "pioneer":
            # Create the table if it doesn't exist
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS decks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    format TEXT NOT NULL,
                    cards TEXT NOT NULL
                )
                """
            )

            # Insert the deck into the database
            cursor.execute(
                """
                INSERT INTO decks (name, format, cards)
                VALUES (?, ?, ?, ?)
                """,
                (deck.name, deck.format, cards_json),
            )
            conn.commit()

        conn.close()

    def loadDeckFromDB(deck_name: str) -> EDHDeck:
        """
        Load a deck from the database by its name.

        Args:
            deck_name (str): The name of the deck to load.

        Returns:
            EDHDeck: The loaded deck object, or None if the deck is not found.
        """
        if not isinstance(deck_name, str) or not deck_name.strip():
            raise ValueError("Invalid deck name provided.")

        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()

        try:
            print(f"Loading deck with name: {deck_name}")
            cursor.execute(
                "SELECT name, format, commander, cards FROM decks WHERE name = ?",
                (deck_name,),
            )
            row = cursor.fetchone()
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return None
        finally:
            conn.close()

        if not row:
            print(f"Deck '{deck_name}' not found in the database.")
            return None

        # Extract data from the row
        deck_name, deck_format, commander_json, cards_json = row

        # Deserialize the commander
        try:
            commander = (
                MTGCard(**json.loads(commander_json)) if commander_json else None
            )
        except (json.JSONDecodeError, TypeError) as e:
            raise ValueError(f"Error decoding commander JSON: {e}")

        # Deserialize the cards
        try:
            cards_data = json.loads(cards_json)
            cards = [MTGCard(**card_data) for card_data in cards_data]
        except json.JSONDecodeError as e:
            raise ValueError(f"Error decoding cards JSON: {e}")

        # Create and return the EDHDeck object
        return EDHDeck(
            name=deck_name,
            format=deck_format,
            commander=commander,
            cards=cards,
        )

    @staticmethod
    def get_card_from_db(card_name: str, strict: bool = False) -> list:
        """
        Search for cards in the database by their name and return MTGCard objects.
        """
        if strict:
            search_pattern = card_name.strip().lower()
        else:
            search_pattern = f"%{card_name.strip().lower()}%"
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()

        try:
            if strict:
                cursor.execute(
                    "SELECT * FROM cards WHERE LOWER(name) = LOWER(?)",
                    (search_pattern,),
                )
            else:
                cursor.execute(
                    "SELECT * FROM cards WHERE LOWER(name) LIKE LOWER(?)",
                    (search_pattern,),
                )
            rows = cursor.fetchall()

            if rows:
                return [
                    MTGCard(
                        name=row[0],
                        manacost=row[1],
                        cmc=row[2],
                        colors=json.loads(row[3]),
                        colorIdentity=json.loads(row[4]),
                        power=row[5],
                        toughness=row[6],
                        oracleText=row[7],
                        loyalty=row[8],
                        supertype=row[9],
                        typeline=row[11],
                        cardType=row[10],
                        artist=row[12],
                        legalities=json.loads(row[13]),
                        image=row[14],
                    )
                    for row in rows
                ]
            else:
                return []
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return []
        finally:
            conn.close()
