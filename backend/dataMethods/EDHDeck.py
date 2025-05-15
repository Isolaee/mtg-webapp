from .MTGDeck import MTGDeck
from .MTGCard import MTGCard
from collections import Counter
from typing import Tuple, Dict


class EDHDeck(MTGDeck):
    """Class representing a Commander (EDH) deck of Magic: The Gathering cards."""

    formatRules: dict = {
        "commander": True,
        "deck_size": 100,
        "singleton": True,
        "color_identity": True,
    }

    def __init__(
        self,
        name: str,
        format: str,
        cards: list,
        commander: MTGCard,
    ) -> None:
        super().__init__(name, cards)
        self.name = name
        self.format = format
        self.cards = cards
        self.commander = commander

    def getName(self) -> str:
        """Return the name of the deck."""
        if self.name == "":
            return "Unnamed Deck"

        return self.name

    def getFormat(self) -> str:
        """Return the format of the deck."""
        return self.format

    def getFormatRules(self) -> list:
        """Return the format rules of the deck."""
        return self.formatRules

    def getCards(self) -> list:
        """Return the cards in the deck."""
        return self.cards

    def getCommander(self) -> MTGCard:
        """Return the commander of the deck."""
        return self.commander

    def getScryfallStatic(self) -> str:
        """Return the Scryfall static URL."""
        return self.scryfallStatic

    def shuffle(self):
        return super().shuffle()

    def draw_card(self):
        return super().draw_card()

    def __str__(self):
        return self.getName()

    def getAllCardNames(self) -> list:
        return super().getAllCardNames()

    def getCardNamesAndAmounts(self):
        """Return a dictionary of card names and their amounts."""
        card_counts = Counter(card.getName() for card in self.cards)
        return dict(card_counts)

    def getDeckData(self) -> dict:
        """Return the deck data as a dictionary. This data is meant to be used for graphical representation."""
        deck_data = {
            "name": self.getName(),
            "format": self.getFormat(),
            "formatRules": self.getFormatRules(),
            "commander": self.getCommander(),
            "cards": self.getAllCardNames(),
            "CMCs": [card.getCMC() for card in self.cards],
        }
        return deck_data

    def getHistogramData(self, histogramType):
        return super().getHistogramData(histogramType)

    def enforceFormatRules(self) -> Tuple[bool, Dict]:
        """Enforce the format rules for the deck."""
        formatCheckFails: dict = {}
        isValid: bool = True

        # Check if the commander is in the deck
        if self.commander.getName() not in self.getAllCardNames():
            formatCheckFails["Commander"] = "Commander not in deck"
            isValid = False

        # Check if the deck size is within the Decklimit
        if len(self.cards) != self.formatRules.get("deck_size"):
            formatCheckFails[
                "Deck Size"
            ] = f"Deck has to be: {self.formatRules.get('deck_size')}, but has {len(self.cards)} cards."
            isValid = False
        else:
            len(self.cards) == self.formatRules.get("deck_size")
            pass

        # Check if contains banned cards using legalities attribute
        for card in self.cards:
            legalities = card.getLegalities()

            # Check if the card is legal in the deck's format
            if legalities.get(self.getFormat()) != "legal":
                formatCheckFails[
                    "Banned Cards"
                ] = f"Contains banned cards: {card.getName()}"
                isValid = False

        # Check singleton rule
        singleton_exceptions = [
            "plains",
            "island",
            "swamp",
            "mountain",
            "forest",
            "snow-covered plains",
            "snow-covered island",
            "snow-covered swamp",
            "snow-covered mountain",
            "snow-covered forest",
            "persistent petitioners",
            "dragon's approach",
            "rat colony",
            "relentless rats",
            "shadowborn apostle",
        ]
        singleton_exceptions = [name.lower() for name in singleton_exceptions]

        duplicates = [
            item
            for item, count in Counter(
                name.lower() for name in self.getAllCardNames()
            ).items()
            if count > 1 and item not in singleton_exceptions
        ]
        if duplicates:
            formatCheckFails[
                "Singleton"
            ] = f"Contains duplicates: {', '.join(duplicates)}"
            isValid = False

        # Check color identity rule
        commander_color_identity = set(self.commander.getColorIdentity())
        invalid_cards = [
            # card.getName()
            self.getName()
            for card in self.cards
            if not set(card.getColorIdentity()).issubset(commander_color_identity)
        ]
        if invalid_cards:
            formatCheckFails[
                "Color Identity"
            ] = f"Cards with invalid color identity: {', '.join(invalid_cards)}"
            isValid = False

        return isValid, formatCheckFails
