import os
import sys

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

# Add the backend directory to the path for relative imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Use relative imports when running from backend directory
try:
    from backend.db import init_db
    from backend.api.routes import api_bp
except ImportError:
    from db import init_db
    from api.routes import api_bp

app = Flask(__name__)
CORS(app, supports_credentials=True, allow_headers=["Content-Type", "Authorization"])

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, "../database/mtg_card_db.db")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.abspath(db_path)}"
app.config["JWT_SECRET_KEY"] = "super-secret-key"  # Set a strong secret in production!

init_db(app)
jwt = JWTManager(app)

app.register_blueprint(api_bp, url_prefix="/api")

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
