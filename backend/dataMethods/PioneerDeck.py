from .MTGDeck import MTGDeck


class PioneerDeck(MTGDeck):
    """Class representing a Commander (EDH) deck of Magic: The Gathering cards."""

    formatRules: dict = {
        "deck_size": 60,
        "singleton": False,
    }

    def __init__(
        self,
        name: str,
        format: str,
        cards: list,
    ) -> None:
        super().__init__(name, cards)
        self.name = name
        self.format = format
        self.cards = cards

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

    def __toString__(self) -> str:
        """Return the string representation of the deck."""
        return self.getName()

    def getCardNamesAndAmounts(self):
        return super().getCardNamesAndAmounts()

    def getDeckData(self):
        """Return the deck data as a dictionary. This data is meant to be used for graphical representation."""
        deck_data = {
            "name": self.getName(),
            "format": self.getFormat(),
            "formatRules": self.getFormatRules(),
            "cards": self.getAllCardNames(),
            "CMCs": [card.getCMC() for card in self.cards],
        }
        return deck_data

    def getHistogramData(self, histogramType):
        return super().getHistogramData(histogramType)

    def enforceFormatRules(self):
        """Enforce the format rules for the deck."""
        # Implement format rules enforcement logic here
        pass
