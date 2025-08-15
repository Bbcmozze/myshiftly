from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import random

db = SQLAlchemy()

# Ассоциативная таблица для друзей
friends = db.Table('friends',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('friend_id', db.Integer, db.ForeignKey('user.id'))
)

# Ассоциативная таблица для участников групп
group_members = db.Table('group_members',
    db.Column('group_id', db.Integer, db.ForeignKey('group.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

class FriendRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_requests')
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref='received_requests')


def generate_user_id():
    return random.randint(10000000, 99999999)


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    avatar = db.Column(db.String(200), default='default_avatar.svg')  # Изменено на SVG
    friends = db.relationship(
        'User', secondary=friends,
        primaryjoin=(friends.c.user_id == id),
        secondaryjoin=(friends.c.friend_id == id),
        backref=db.backref('friend_of', lazy='dynamic'), lazy='dynamic'
    )

    def __repr__(self):
        return f"User('{self.username}', '{self.email}')"


class Calendar(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_team = db.Column(db.Boolean, default=False)

    owner = db.relationship('User', backref='calendars')
    members = db.relationship('User', secondary='calendar_members', backref='shared_calendars')
    shift_templates = db.relationship('ShiftTemplate', back_populates='calendar', lazy='dynamic', cascade='all, delete-orphan')
    shifts = db.relationship('Shift', back_populates='calendar', lazy='dynamic', cascade='all, delete-orphan')
    groups = db.relationship('Group', back_populates='calendar', lazy='dynamic', cascade='all, delete-orphan')


class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(20), default='badge-color-1', nullable=False)
    calendar_id = db.Column(db.Integer, db.ForeignKey('calendar.id'), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    calendar = db.relationship('Calendar', back_populates='groups')
    owner = db.relationship('User', backref='created_groups')
    members = db.relationship('User', secondary=group_members, backref='groups')


class Shift(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    calendar_id = db.Column(db.Integer, db.ForeignKey('calendar.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    date = db.Column(db.Date, nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('shift_template.id'))
    show_time = db.Column(db.Boolean, default=True)
    color_class = db.Column(db.String(20), default='badge-color-1', nullable=False)

    user = db.relationship('User', backref='shifts')
    calendar = db.relationship('Calendar', back_populates='shifts')
    template = db.relationship('ShiftTemplate', backref='shifts')

# Ассоциативная таблица для участников календаря
calendar_members = db.Table('calendar_members',
    db.Column('calendar_id', db.Integer, db.ForeignKey('calendar.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('position', db.Integer)  # Новое поле для порядка
)


class ShiftTemplate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    calendar_id = db.Column(db.Integer, db.ForeignKey('calendar.id'), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    show_time = db.Column(db.Boolean, default=True)
    color_class = db.Column(db.String(20), default='badge-color-1', nullable=False)

    calendar = db.relationship('Calendar', back_populates='shift_templates')
    owner = db.relationship('User', backref='shift_templates')