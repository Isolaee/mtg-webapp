from .Deck import Deck
from abc import ABC, abstractmethod


class MTGDeck(Deck, ABC):
    """Class representing a deck of Magic: The Gathering cards."""

    def __init__(self, name: str, cards: list) -> None:
        super().__init__(name)
        self.name = name
        self.cards: list = cards

    @abstractmethod
    def getName(self) -> str:
        """Return the name of the deck."""
        return self.name

    @abstractmethod
    def getScryfallStatic(self) -> str:
        """Return the Scryfall static URL."""
        return self.scryfallStatic

    @abstractmethod
    def shuffle(self) -> None:
        """Shuffle the deck."""
        import random

        random.shuffle(self.cards)

    @abstractmethod
    def draw_card(self):
        """Draw a card from the top of the deck."""
        if self.cards:
            return self.cards.pop(0)
        else:
            raise ValueError("The deck is empty.")

    @abstractmethod
    def getAllCardNames(self):
        """Return a list of all card names in the deck."""
        return [card.getName() for card in self.cards]

    @abstractmethod
    def getDeckData(self) -> dict:
        """Return the deck data as a dictionary. This data is meant to be used for graphical representation."""
        pass

    @abstractmethod
    def getHistogramData(self, histogramType) -> dict:
        """Return a dict that has relevant data for Histograms
        Params: Histogram Type, CMC, CardType
        """

        values = {}
        parsedData: dict = {}

        # CMC histogram
        if histogramType == "CMC":
            for card in self.cards:
                if card.getCMC() != 0:
                    if card.getCMC() in parsedData:
                        parsedData[card.getCMC()] += 1
                    else:
                        parsedData[card.getCMC()] = 1

            values = parsedData

        # CardType histogram
        elif histogramType == "CardType":
            parsedData: dict
            for card in self.cards:
                if card.getCardType() in parsedData:
                    parsedData[card.getCardType()] += 1
                else:
                    parsedData[card.getCardType()] = 1
            values = parsedData
        else:
            return values

        return values

    def to_dict(self):
        """Convert the EDHDeck object to a dictionary."""
        return {
            "name": self.name,
            "format": self.format,
            "formatRules": self.formatRules,
            "commander": (
                self.commander
                if isinstance(self.commander, str)
                else self.commander.to_dict()
                if self.commander
                else None
            ),
            "cards": [card.to_dict() for card in self.cards],
        }
