from flask import Blueprint, jsonify, request
from ..db.models import CardModel
from ..db import db

api = Blueprint("api", __name__)


@api.route("/cards", methods=["GET"])
def get_cards():
    name = request.args.get("name")
    if name:
        cards = CardModel.query.filter_by(name=name).all()
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


api_bp = api
