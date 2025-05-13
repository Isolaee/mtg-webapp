from .EDHDeck import EDHDeck
from .MTGCard import MTGCard
from pathlib import Path
import json


class DeckParser:
    """Utility class for parsing deck lists."""

    @staticmethod
    def CreateDeck(
        file_path: str,
        deck_name: str,
        format: str,
        commander_name: str,
        regex_engine_card,
        regex_engine_type,
    ):
        cards = []
        ScryData = "Data\\ScryfallCardData13_04_2025.json"
        commander = commander_name
        if format != "Commander":
            commander = None

        # Load Scryfall data from JSON using json_stream
        with open(ScryData, "r", encoding="utf-8") as scryfall_file:
            scryfall_data = json.load(scryfall_file)

            with open(file_path, "r") as file:
                for line in file:
                    try:
                        match = regex_engine_card.search(line)
                        if not match:
                            raise ValueError(f"Invalid line format: {line.strip()}")
                        card_name = match.group("name").strip()
                        quantity = int(match.group("amount"))

                        # Find card data in Scryfall JSON
                        card_data = next(
                            (
                                card
                                for card in scryfall_data
                                if card["name"] == card_name
                            ),
                            None,
                        )
                        if not card_data:
                            raise ValueError(
                                f"Card '{card_name}' not found in Scryfall data."
                            )

                        creature_type_match = regex_engine_type.search(
                            card_data["type_line"]
                        )
                        if creature_type_match:
                            cardType = creature_type_match.group("CardType")
                            creatureType = creature_type_match.group("CreatureType")
                        else:
                            cardType = "Unknown"  # Assign a default value for cardType if needed
                            creatureType = ""  # Assign a default value for creatureType

                        card = MTGCard(
                            name=card_name,
                            manacost=card_data.get("mana_cost"),
                            cmc=card_data.get("cmc"),
                            colors=card_data.get("colors"),
                            colorIdentity=card_data.get("color_identity"),
                            power=card_data.get("power"),
                            toughness=card_data.get("toughness"),
                            oracleText=card_data.get("oracle_text"),
                            loyalty=card_data.get("loyalty"),
                            typeline=creatureType,
                            cardType=cardType,
                            cardFaces=card_data.get("card_faces"),
                            allParts=card_data.get("all_parts"),
                            layout=card_data.get("layout"),
                            artist=card_data.get("artist"),
                            scryfallid=card_data.get("id"),
                            legalities="Commander",
                        )

                        for _ in range(quantity):
                            cards.append(card)

                        if card_name == commander_name:
                            commander = card
                    except ValueError as e:
                        print(f"Error': {e}")
                        continue

        if not commander:
            raise ValueError(
                f"Commander '{commander_name}' not found in the deck list."
            )

        return EDHDeck(
            name=deck_name,
            format="Commander",
            formatRules=["Singleton", "100 cards"],
            cards=cards,
            commander=commander,
        )

    @staticmethod
    def serializeDeck(deck) -> None:
        """
        Serialize the EDHDeck object to a JSON file.

        Args:
            deck (EDHDeck): The deck object to serialize.
        """
        file_path = "Decks/" + deck.name + ".json"
        deck = deck.to_dict()  # Convert the deck object to a dictionary
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(deck, file, indent=4)

    @staticmethod
    def deserializeDeck(file_path: str) -> EDHDeck:
        """
        Deserialize an EDHDeck object from a JSON file.

        Args:
            file_path (str): The path to the JSON file.

        Returns:
            EDHDeck: The deserialized deck object.
        """
        with open(file_path, "r", encoding="utf-8") as file:
            deck_data = json.load(file)

        # Validate and recreate the MTGCard objects
        cards = []
        for card_data in deck_data["cards"]:
            if isinstance(card_data, dict):  # Ensure card_data is a dictionary
                cards.append(MTGCard(**card_data))
            else:
                raise ValueError(f"Invalid card data: {card_data}")

        # Validate and recreate the commander object
        commander = None
        if deck_data["commander"]:
            if isinstance(
                deck_data["commander"], dict
            ):  # Ensure commander is a dictionary
                commander = MTGCard(**deck_data["commander"])
            else:
                raise ValueError(f"Invalid commander data: {deck_data['commander']}")

        # Return the reconstructed EDHDeck object
        return EDHDeck(
            name=deck_data["name"],
            format=deck_data["format"],
            cards=cards,
            commander=commander,
        )

    @staticmethod
    def read_folder_contents(folder_path):
        """
        Read the contents of a folder and return a list of file names.

        Args:
            folder_path (str): The path to the folder.

        Returns:
            list: A list of file names in the folder.
        """
        folder = Path(folder_path)
        if folder.exists() and folder.is_dir():
            return [item.name for item in folder.iterdir() if item.is_file()]
        else:
            print(f"The folder '{folder_path}' does not exist.")
            return []

    # Saved Decks
    @staticmethod
    def loadSavedDecks(file_path: str):
        """
        Load saved decks from the JSON file.

        Returns:
            list: A list of saved decks.
        """

        try:
            with open(file_path, "r") as file:
                return json.load(file)
        except FileNotFoundError:
            return []

    @staticmethod
    def find_line_with_name(target_names: list) -> dict:
        """
        Find entries in a JSON file where the 'name' field matches any of the target strings
        and save the corresponding data in a dictionary. Remove processed names from the target list.
        Args:
            target_names (list): The names to search for.

        Returns:
            dict: A dictionary containing the matching 'name' fields and their corresponding JSON objects.
        """
        file_path = "Data\\ScryfallCardData13_04_2025.json"
        deckData: dict = {}

        with open(file_path, "r", encoding="utf-8") as file:
            # Load the JSON data
            json_data = json.load(file)
            # Iterate through the JSON data
            for entry in json_data:
                # Check if the 'name' field matches any of the target names
                if entry.get("name") in target_names:
                    # Add the matching entry to the result dictionary
                    deckData[entry["name"]] = entry

                if not target_names:
                    break

        return deckData

    @staticmethod
    def CreateDictkWithList(
        file_path: str,
        regex_engine_card,
    ):
        """
        Create a dictionary with card names and their quantities from a file.
        """
        cardNames: dict = {}

        with open(file_path, "r") as file:
            i = 0
            for line in file:
                try:
                    match = regex_engine_card.search(line)
                    if not match:
                        raise ValueError(f"Invalid line format: {line.strip()}")
                    card_name = match.group("name").strip()
                    quantity = int(match.group("amount"))
                    cardNames[card_name] = {"quantity": quantity}
                    i += 1
                except ValueError as e:
                    print(f"Error': {e}")
                continue

        return cardNames

    @staticmethod
    def CreateEDHDeck(
        file_path: str,
        deck_name: str,
        format: str,
        commander_name: str,
        regex_engine_card,
        regex_engine_type,
    ) -> EDHDeck:

        cards: list = []

        commander = commander_name

        namesDict = DeckParser.CreateDictkWithList(file_path, regex_engine_card)

        cardsDict = DeckParser.find_line_with_name(namesDict)

        for card_name, card_data in cardsDict.items():
            if card_name not in namesDict:
                print(f"Warning: '{card_name}' not found in namesDict. Skipping...")
                continue  # Skip this card if it's not in namesDict

            creature_type_match = regex_engine_type.search(card_data["type_line"])

            if creature_type_match:
                cardType = creature_type_match.group("CardType")
                creatureType = creature_type_match.group("CreatureType")
            else:
                cardType = "Unknown"  # Assign a default value for cardType if needed
                creatureType = ""  # Assign a default value for creatureType

            card = MTGCard(
                name=card_data.get("name"),
                manacost=card_data.get("mana_cost"),
                cmc=card_data.get("cmc"),
                colors=card_data.get("colors"),
                colorIdentity=card_data.get("color_identity"),
                power=card_data.get("power", "N/A"),
                toughness=card_data.get("toughness", "N/A"),
                oracleText=card_data.get("oracle_text", "No Oracle Text"),
                loyalty=card_data.get("loyalty", "N/A"),
                typeline=creatureType,
                cardType=cardType,
                cardFaces=card_data.get("card_faces"),
                allParts=card_data.get("all_parts"),
                layout=card_data.get("layout"),
                artist=card_data.get("artist"),
                scryfallid=card_data.get("id"),
                legalities=card_data.get("legalities"),
                image=card_data.get("image_uris", {}).get("normal", None),
            )

            for _ in range(namesDict[card_name]["quantity"]):
                cards.append(card)

            if card_data.get("name") == commander_name:
                commander = card

        deck = EDHDeck(
            name=deck_name,
            format="commander",
            cards=cards,
            commander=commander,
        )

        # Check for format legality
        isValid, error = deck.enforceFormatRules()
        cond = False
        if isValid == cond:
            raise ValueError(error)

        return deck

    @staticmethod
    def CreateSingleMTGCard(card_name) -> MTGCard:
        """
        Create a single MTGCard object with proper values.
        Returns a MTGCard object.
        """
        ScryData = "Data\\ScryfallCardData13_04_2025.json"
        with open(ScryData, "r", encoding="utf-8") as scryfall_file:
            scryfall_data = json.load(scryfall_file)

            # Find card data in Scryfall JSON
            card_data = next(
                (card for card in scryfall_data if card["name"] == card_name), None
            )
            if not card_data:
                raise ValueError(f"Card '{card_name}' not found in Scryfall data.")

            card = MTGCard(
                name=card_name,
                manacost=card_data.get("mana_cost"),
                cmc=card_data.get("cmc"),
                colors=card_data.get("colors"),
                colorIdentity=card_data.get("color_identity"),
                power=card_data.get("power"),
                toughness=card_data.get("toughness"),
                oracleText=card_data.get("oracle_text"),
                loyalty=card_data.get("loyalty"),
                typeline=card_data.get("type_line"),
                cardType=card_data.get("type_line"),
                cardFaces=card_data.get("card_faces"),
                allParts=card_data.get("all_parts"),
                layout=card_data.get("layout"),
                artist=card_data.get("artist"),
                scryfallid=card_data.get("id"),
                legalities="Commander",
                image=card_data.get("image_uris", {}).get("normal"),
            )

        return card

    @staticmethod
    def create_card_object(card_name):
        """
        Search for a card in the database and create an MTGCard object.
        Args:
            card_name (str): The name of the card to search for.
        Returns:
            MTGCard: An MTGCard object, or raises an exception if the card is not found.
        """
        card_data = DeckParser.get_card_from_db(card_name)

        if not card_data:
            raise ValueError(f"Card '{card_name}' not found in the database.")

        # Create and return the MTGCard object
        return MTGCard(
            name=card_data["name"],
            manacost=card_data["manacost"],
            cmc=card_data["cmc"],
            colors=json.loads(card_data["colors"]),  # Convert JSON string back to list
            colorIdentity=json.loads(
                card_data["coloridentity"]
            ),  # Convert JSON string back to list
            power=card_data["power"],
            toughness=card_data["toughness"],
            oracleText=card_data["oracletext"],
            loyalty=card_data["loyalty"],
            typeline=card_data["typeline"],
            cardType=card_data["cardtype"],
            cardFaces=json.loads(
                card_data["cardfaces"]
            ),  # Convert JSON string back to list
            allParts=json.loads(
                card_data["allparts"]
            ),  # Convert JSON string back to list
            layout=card_data["layout"],
            artist=card_data["artist"],
            scryfallid=None,  # Not stored in the database, set to None or add it to the schema
            legalities=json.loads(
                card_data["legalities"]
            ),  # Convert JSON string back to dict
            image=card_data["image"],
        )
