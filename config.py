import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-123'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = str(BASE_DIR / 'static')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'}
    
    # Database configuration
    if os.environ.get('FLASK_ENV') == 'production':
        # Production database path for PythonAnywhere
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str(BASE_DIR / 'database' / 'users.db')
    else:
        # Development database
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str(BASE_DIR / 'database' / 'users.db')
    
    # Additional production settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file upload
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours session timeout