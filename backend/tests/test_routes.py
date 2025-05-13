import pytest
from backend.api.routes import api
from backend.db import db
from backend.db.models import CardModel
from flask import Flask


@pytest.fixture
def client():
    app = Flask(__name__)
    app.register_blueprint(api, url_prefix="/api")
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    db.init_app(app)
    with app.app_context():
        db.create_all()
        # Add some test cards
        db.session.add(
            CardModel(
                name="Animar", manacost="{G}{U}{R}", typeline="Legendary Creature"
            )
        )
        db.session.add(
            CardModel(name="Lightning Bolt", manacost="{R}", typeline="Instant")
        )
        db.session.commit()
        yield app.test_client()


def test_get_cards_correct_input(client):
    response = client.get("/api/cards?name=Animar")
    assert response.status_code == 200
    data = response.get_json()
    assert any(card["name"].lower() == "animar" for card in data)


def test_get_cards_empty_name_param(client):
    response = client.get("/api/cards?name=")
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Name parameter is empty"


def test_get_cards_non_character_input(client):
    response = client.get("/api/cards?name=123456")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    # Should return empty or no matching cards
