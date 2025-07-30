from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import random

db = SQLAlchemy()

def generate_user_id():
    return random.randint(10000000, 99999999)

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    avatar = db.Column(db.String(200), default='default_avatar.svg')  # Изменено на SVG

    def __repr__(self):
        return f"User('{self.username}', '{self.email}')"