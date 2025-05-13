from abc import ABC, abstractmethod


class Deck(ABC):
    """Abstract base class for a Deck."""

    def __init__(
        self,
        name: str,
    ):

        self.name = name

    @abstractmethod
    def __str__(self) -> str:
        """Return a string representation of the deck."""
        pass

    @abstractmethod
    def getAllCardNames(self) -> list:
        """Return a list of all card names in the deck."""
        pass

    @abstractmethod
    def getCardNamesAndAmounts(self) -> dict:
        """Return a dictionary of card names and their amounts."""
        pass
