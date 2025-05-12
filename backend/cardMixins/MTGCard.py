class MTGCard:
    """Mixin for a Magic: The Gathering card."""

    def getName(self):
        """Return the name of the card."""
        return self.name

    def getManaCost(self):
        """Return the mana cost of the card."""
        return self.manacost

    def getCMC(self):
        """Return the converted mana cost of the card."""
        return self.cmc

    def getColors(self):
        """Return the colors of the card."""
        return self.colors

    def getColorIdentity(self):
        """Return the color identity of the card."""
        return self.colorIdentity

    def getPower(self):
        """Return the power of the card."""
        return self.power

    def getToughness(self):
        """Return the toughness of the card."""
        return self.toughness

    def getOracleText(self):
        """Return the oracle text of the card."""
        return self.oracleText

    def getLoyalty(self):
        """Return the loyalty of the card."""
        return self.loyalty

    def getTypeLine(self):
        """Return the type line of the card."""
        return self.typeline

    def getCardType(self):
        """Return the card type of the card."""
        return self.cardType

    def getCardFaces(self):
        """Return the card faces of the card."""
        return self.cardFaces

    def getAllParts(self):
        """Return all parts of the card."""
        return self.allParts

    def getLayout(self):
        """Return the layout of the card."""
        return self.layout

    def getArtist(self):
        """Return the artist of the card."""
        return self.artist

    def getScryfallID(self):
        """Return the Scryfall ID of the card."""
        return self.scryfallid

    def getLegalities(self):
        """Return the legalities of the card."""
        return self.legalities

    def __str__(self):
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
            "legalities": self.legalities,
            "image": self.image,
        }

    def getImage(self):
        """Return the image PNG of the card."""
        cond = None
        if not cond:
            value = self.image
        else:
            value = "Card Not Found"

        return value
