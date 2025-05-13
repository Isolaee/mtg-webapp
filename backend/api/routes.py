from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from passlib.hash import bcrypt
from sqlalchemy import or_
from ..db.models import CardModel, UserModel
from ..db import db
import json


api = Blueprint("api", __name__)


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
    try:
        content = file.read().decode("utf-8")
        # Example: parse as JSON array of cards
        cards = json.loads(content)
        # Optionally validate cards here
        return jsonify({"cards": cards}), 200
    except Exception as e:
        return jsonify({"msg": f"Invalid file: {str(e)}"}), 400


api_bp = api
