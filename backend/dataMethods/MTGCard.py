from .PlayingCard import PlayingCard
from typing import List


class MTGCard(PlayingCard):
    """Class for a Magic: The Gathering card."""

    def __init__(
        self,
        name: str,
        manacost: list,
        cmc: int,
        colors: list,
        colorIdentity: list,
        power: int,
        toughness: int,
        oracleText: str,
        loyalty: str,
        typeline: str,
        cardType: str,
        cardFaces: str,
        allParts: str,
        layout: str,
        artist: str,
        scryfallid: int,
        legalities: str,
        image: str,
    ) -> None:

        super().__init__(name, legalities)
        self.name = name
        self.manacost = manacost
        self.cmc = cmc
        self.colors = colors
        self.colorIdentity = colorIdentity
        self.power = power
        self.toughness = toughness
        self.oracleText = oracleText
        self.loyalty = loyalty
        self.typeline = typeline
        self.cardType = cardType
        self.cardFaces = cardFaces
        self.allParts = allParts
        self.layout = layout
        self.artist = artist
        self.scryfallid = scryfallid
        self.legalities = legalities
        self.image = image

    def getName(self) -> str:
        """Return the name of the card."""
        return self.name

    def getManaCost(self) -> List[str]:
        """Return the mana cost of the card."""
        return self.manacost

    def getCMC(self) -> int:
        """Return the converted mana cost of the card."""
        return self.cmc

    def getColors(self) -> List[str]:
        """Return the colors of the card."""
        return self.colors

    def getColorIdentity(self) -> List[str]:
        """Return the color identity of the card."""
        return self.colorIdentity

    def getPower(self) -> int:
        """Return the power of the card."""
        return self.power

    def getToughness(self) -> int:
        """Return the toughness of the card."""
        return self.toughness

    def getOracleText(self) -> str:
        """Return the oracle text of the card."""
        return self.oracleText

    def getLoyalty(self) -> str:
        """Return the loyalty of the card."""
        return self.loyalty

    def getTypeLine(self) -> str:
        """Return the type line of the card."""
        return self.typeline

    def getCardType(self) -> str:
        """Return the card type of the card."""
        return self.cardType

    def getCardFaces(self) -> str:
        """Return the card faces of the card."""
        return self.cardFaces

    def getAllParts(self) -> str:
        """Return all parts of the card."""
        return self.allParts

    def getLayout(self) -> str:
        """Return the layout of the card."""
        return self.layout

    def getArtist(self) -> str:
        """Return the artist of the card."""
        return self.artist

    def getScryfallID(self) -> int:
        """Return the Scryfall ID of the card."""
        return self.scryfallid

    def getLegalities(self) -> str:
        """Return the legalities of the card."""
        return self.legalities

    def __str__(self) -> str:
        """Return a string representation of the card."""
        return self.getName()

    def __eq__(self, other):
        return super().__eq__(other)

    def to_dict(self):
        """Convert the MTGCard object to a dictionary."""
        return {
            "name": self.name,
            "manacost": self.manacost,
            "cmc": self.cmc,
            "colors": self.colors,
            "colorIdentity": self.colorIdentity,
            "power": self.power,
            "toughness": self.toughness,
            "oracleText": self.oracleText,
            "loyalty": self.loyalty,
            "typeline": self.typeline,
            "cardType": self.cardType,
            "cardFaces": self.cardFaces,
            "allParts": self.allParts,
            "layout": self.layout,
            "artist": self.artist,
            "scryfallid": self.scryfallid,
            "legalities": self.legalities,
            "image": self.image,
        }

    def getImage(self) -> str:
        """Return the image PNG of the card."""
        cond = None
        if not cond:
            value = self.image
        else:
            value = "Card Not Found"

        return value
