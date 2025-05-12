from backend.db import db
from backend.cardMixins.MTGCard import MTGCard


class CardModel(db.Model, MTGCard):
    __tablename__ = "cards"

    name = db.Column(db.String, primary_key=True)
    manacost = db.Column(db.String)
    cmc = db.Column(db.Float)
    colors = db.Column(db.JSON)
    colorIdentity = db.Column(db.JSON)
    power = db.Column(db.String)
    toughness = db.Column(db.String)
    oracleText = db.Column(db.Text)
    loyalty = db.Column(db.String)
    typeline = db.Column(db.String)
    cardType = db.Column(db.String)
    cardFaces = db.Column(db.JSON)
    allParts = db.Column(db.JSON)
    layout = db.Column(db.String)
    artist = db.Column(db.String)
    legalities = db.Column(db.JSON)
    image = db.Column(db.String)


class DeckModel(db.Model):
    __tablename__ = "decks"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    format = db.Column(db.String, nullable=False)
    commander = db.Column(db.JSON)
    cards = db.Column(db.JSON)
