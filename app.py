import os 
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from config import config
from routes import bp as api_bp

def create_app():
    load_dotenv()
    app = Flask(__name__)
    
    # Load configuration based on environment
    config_name = os.getenv("FLASK_ENV", "production")
    app.config.from_object(config[config_name])
    
    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", ["*"])}})
    
    # Register blueprints
    app.register_blueprint(api_bp)
    
    return app

app = create_app()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=app.config.get("PORT", 5001),
        debug=(app.config.get("FLASK_ENV") == "development"),
    )