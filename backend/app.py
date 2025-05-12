from flask import Flask
from flask_cors import CORS
from db import init_db
from api.routes import api_bp

app = Flask(__name__)
CORS(app)

app.config['DATABASE'] = 'database/mtg_card_db.db'

init_db(app)

app.register_blueprint(api_bp)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)