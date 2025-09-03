import os

class BaseConfig:
    FLASK_ENV = os.getenv("FLASK_ENV", "production")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
    PORT = int(os.getenv("PORT", "5001"))
    HUGGINGFACE_API_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN", "")
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///calgary_dashboard.db")
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

class DevelopmentConfig(BaseConfig):
    FLASK_ENV = "development"
    DEBUG = True

class ProductionConfig(BaseConfig):
    FLASK_ENV = "production"
    DEBUG = False

# Choose config based on environment
config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": ProductionConfig
}