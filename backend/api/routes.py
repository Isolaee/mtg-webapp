from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from passlib.hash import bcrypt
from sqlalchemy import or_
import json
import tempfile
import os
import re

# Handle both relative and absolute imports
try:
    from ..db.models import CardModel, UserModel, DeckModel
    from ..db import db
    from ..dataMethods.DeckService import DeckService
except ImportError:
    from db.models import CardModel, UserModel, DeckModel
    from db import db
    from dataMethods.DeckService import DeckService


api = Blueprint("api", __name__)

# Regex patterns for parsing card names and types
regex_engine_card = re.compile(r"(?P<amount>\d+)x?,?\s+(?P<name>.+)")


@api.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400
    if UserModel.query.filter_by(username=username).first():
        return jsonify({"msg": "User already exists"}), 400
    user = UserModel(username=username, password_hash=bcrypt.hash(password))
    db.session.add(user)
    db.session.commit()
    return jsonify({"msg": "User registered"}), 201


@api.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    user = UserModel.query.filter_by(username=username).first()
    if not user or not bcrypt.verify(password, user.password_hash):
        return jsonify({"msg": "Bad username or password"}), 401
    access_token = create_access_token(identity=username)
    return jsonify(access_token=access_token), 200


@api.route("/whoami", methods=["GET"])
@jwt_required()
def whoami():
    current_user = get_jwt_identity()
    return jsonify(username=current_user), 200


@api.route("/cards", methods=["GET"])
def get_cards():
    name = request.args.get("name")
    if name is not None and name.strip() == "":
        return jsonify({"error": "Name parameter is empty"}), 400
    if name:
        names = [n.strip().lower() for n in name.split(";")]
        filters = [CardModel.name.ilike(f"%{n}%") for n in names if n]
        cards = CardModel.query.filter(or_(*filters)).all()
    else:
        cards = CardModel.query.all()
    return jsonify([card.to_dict() for card in cards])


@api.route("/cards/<int:card_id>", methods=["GET"])
def get_card(card_id):
    card = CardModel.query.get(card_id)
    if card:
        return jsonify(card.to_dict())
    return jsonify({"error": "Card not found"}), 404


@api.route("/cards", methods=["POST"])
def create_card():
    data = request.json
    new_card = CardModel(**data)  # Assuming data matches the Card model fields
    db.session.add(new_card)
    db.session.commit()
    return jsonify(new_card.to_dict()), 201


@api.route("/cards/<int:card_id>", methods=["PUT"])
def update_card(card_id):
    card = CardModel.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    data = request.json
    for key, value in data.items():
        setattr(card, key, value)
    db.session.commit()
    return jsonify(card.to_dict())


@api.route("/cards/<int:card_id>", methods=["DELETE"])
def delete_card(card_id):
    card = CardModel.query.get(card_id)
    if not card:
        return jsonify({"error": "Card not found"}), 404

    db.session.delete(card)
    db.session.commit()
    return jsonify({"message": "Card deleted successfully"})


@api.route("/upload_deck", methods=["POST"])
def upload_deck():
    if "deckfile" not in request.files:
        return jsonify({"msg": "No file uploaded"}), 400
    file = request.files["deckfile"]

    format = request.form.get("format", "commander")
    commander_name = request.form.get("commander_name", "")
    deck_name = request.form.get("deck_name", "Uploaded Deck")

    # Save the uploaded file to a temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp:
        file.save(temp)
        temp_path = temp.name

    try:
        # Call your DeckParser method
        deck_obj = DeckService.CreateDeckFromDB(
            file_path=temp_path,
            deck_name=deck_name,
            format=format,
            commander_name=commander_name,
            regex_engine_card=regex_engine_card,
        )

        # Clean up the temp file
        os.remove(temp_path)

        # Return the deck as a dict
        return jsonify(deck_obj.to_dict()), 200

    except Exception as e:
        os.remove(temp_path)
        return jsonify({"msg, upload deck": f"Invalid file: {str(e)}"}), 400


@api.route("/save_deck", methods=["POST"])
def save_deck():
    if "deckfile" not in request.files:
        return jsonify({"msg": "No file uploaded"}), 400
    file = request.files["deckfile"]

    format = request.form.get("format", "EDH")
    commander_name = request.form.get("commander_name", "")
    deck_name = request.form.get("deck_name", "Uploaded Deck")
    deck_description = request.form.get("deck_description", "")

    # Save the uploaded file to a temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp:
        file.save(temp)
        temp_path = temp.name

    try:
        # Parse and validate the deck
        deck_obj = DeckService.CreateDeckFromDB(
            file_path=temp_path,
            deck_name=deck_name,
            format=format,
            commander_name=commander_name,
            regex_engine_card=regex_engine_card,
        )

        new_deck = DeckModel(
            name=deck_name,
            description=deck_description,
            format=format,
            commander=commander_name,
            cards=json.dumps([card.to_dict() for card in deck_obj.cards]),
        )
        db.session.add(new_deck)
        db.session.commit()

        os.remove(temp_path)
        return jsonify({"msg": "Deck saved successfully!"}), 200

    except Exception as e:
        os.remove(temp_path)
        return jsonify({"msg, save deck": f"Failed to save deck: {str(e)}"}), 400


@api.route("/list_decks", methods=["GET"])
def list_decks():
    decks = DeckModel.query.all()
    return jsonify(
        {
            "decks": [
                {"deck_name": deck.name, "deck_description": deck.description}
                for deck in decks
            ]
        }
    )


@api.route("/load_deck", methods=["GET"])
def load_deck_from_db():
    deck_name = request.args.get("deck_name")
    if not deck_name:
        return jsonify({"msg": "Missing deck_name parameter"}), 400

    deck = DeckModel.query.filter_by(name=deck_name).first()
    if not deck:
        return jsonify({"msg": "Deck not found"}), 404

    return (
        jsonify(
            {
                "deck_name": deck.name,
                "deck_description": deck.description,
                "format": deck.format,
                "commander_name": deck.commander,
                "cards": json.loads(deck.cards) if deck.cards else [],
            }
        ),
        200,
    )


api_bp = api
