from flask import Flask
from flask_login import LoginManager
from models import db
from config import Config
import os

from routes import add_jinja2_filters


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Создаем папки если их нет
    os.makedirs(os.path.join(app.root_path, 'database'), exist_ok=True)
    os.makedirs(os.path.join(app.root_path, 'static', 'images'), exist_ok=True)

    # Инициализация базы данных
    db.init_app(app)

    # Настройка Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'login'

    from models import User

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    from routes import register_routes
    register_routes(app)
    add_jinja2_filters(app)
    return app


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(debug=True)