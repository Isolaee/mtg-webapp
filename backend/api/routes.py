from flask import Blueprint, jsonify, request
from ..db.models import Card  # Assuming Card is a model defined in models.py
from ..db import db_session  # Assuming db_session is a SQLAlchemy session

api = Blueprint('api', __name__)

@api.route('/cards', methods=['GET'])
def get_cards():
    cards = Card.query.all()
    return jsonify([card.to_dict() for card in cards])  # Assuming Card has a to_dict method

@api.route('/cards/<int:card_id>', methods=['GET'])
def get_card(card_id):
    card = Card.query.get(card_id)
    if card:
        return jsonify(card.to_dict())
    return jsonify({'error': 'Card not found'}), 404

@api.route('/cards', methods=['POST'])
def create_card():
    data = request.json
    new_card = Card(**data)  # Assuming data matches the Card model fields
    db_session.add(new_card)
    db_session.commit()
    return jsonify(new_card.to_dict()), 201

@api.route('/cards/<int:card_id>', methods=['PUT'])
def update_card(card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({'error': 'Card not found'}), 404

    data = request.json
    for key, value in data.items():
        setattr(card, key, value)
    db_session.commit()
    return jsonify(card.to_dict())

@api.route('/cards/<int:card_id>', methods=['DELETE'])
def delete_card(card_id):
    card = Card.query.get(card_id)
    if not card:
        return jsonify({'error': 'Card not found'}), 404

    db_session.delete(card)
    db_session.commit()
    return jsonify({'message': 'Card deleted successfully'})