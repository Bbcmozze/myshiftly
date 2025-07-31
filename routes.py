from flask import render_template, request, redirect, url_for, flash, jsonify, abort
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User, generate_user_id, FriendRequest, Calendar, Shift
from datetime import datetime
from config import Config
import os
from werkzeug.utils import secure_filename


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def register_routes(app):
    @app.route('/')
    def home():
        return render_template('index.html')

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            email = request.form.get('email')
            password = request.form.get('password')

            user = User.query.filter_by(email=email).first()

            if user and check_password_hash(user.password_hash, password):
                login_user(user)
                flash('Вы успешно вошли в систему!', 'success')
                return redirect(url_for('home'))
            else:
                flash('Неверный email или пароль', 'danger')

        return render_template('auth/login.html')

    @app.route('/register', methods=['GET', 'POST'])
    def register():
        if request.method == 'POST':
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
            confirm_password = request.form.get('confirm_password')

            # Проверка длины пароля
            if len(password) < 8:
                flash('Пароль должен содержать не менее 8 символов', 'danger')
                return redirect(url_for('register'))

            if password != confirm_password:
                flash('Пароли не совпадают', 'danger')
                return redirect(url_for('register'))

            existing_user = User.query.filter(
                (User.username == username) |
                (User.email == email)
            ).first()

            if existing_user:
                flash('Имя пользователя или email уже заняты', 'danger')
                return redirect(url_for('register'))

            user_id = generate_user_id()
            while User.query.get(user_id):
                user_id = generate_user_id()

            hashed_password = generate_password_hash(password)
            new_user = User(
                id=user_id,
                username=username,
                email=email,
                password_hash=hashed_password
            )

            db.session.add(new_user)
            db.session.commit()

            flash('Регистрация прошла успешно! Теперь вы можете войти.', 'success')
            return redirect(url_for('login'))

        return render_template('auth/register.html')

    @app.route('/logout')
    @login_required
    def logout():
        logout_user()
        flash('Вы успешно вышли из системы', 'success')
        return redirect(url_for('home'))


    @app.route('/friends', methods=['GET'])
    @login_required
    def friends_page():
        return render_template('friends/friends.html')


    @app.route('/friends/add', methods=['POST'])
    @login_required
    def send_friend_request():
        username = request.form.get('username')
        user = User.query.filter_by(username=username).first()

        if not user or user.id == current_user.id:
            flash("Пользователь не найден", "danger")
        elif user in current_user.friends:
            flash("Этот пользователь уже в вашем списке друзей", "danger")
        else:
            existing_request = FriendRequest.query.filter_by(sender_id=current_user.id, receiver_id=user.id).first()
            if not existing_request:
                request_obj = FriendRequest(sender_id=current_user.id, receiver_id=user.id)
                db.session.add(request_obj)
                db.session.commit()
                flash("Запрос отправлен", "success")
            else:
                flash("Вы уже отправили запрос этому пользователю", "info")

        return redirect(url_for('friends_page'))


    @app.route('/friends/requests', methods=['POST'])
    @login_required
    def handle_friend_request():
        action = request.form.get('action')
        request_id = request.form.get('request_id')
        friend_request = FriendRequest.query.get(request_id)

        if friend_request and friend_request.receiver_id == current_user.id:
            sender = User.query.get(friend_request.sender_id)
            if action == 'accept':
                current_user.friends.append(sender)
                sender.friends.append(current_user)
                flash(f"Вы теперь друзья с {sender.username}", "success")
            elif action == 'reject':
                flash(f"Запрос от {sender.username} отклонен", "info")

            db.session.delete(friend_request)
            db.session.commit()

        return redirect(url_for('friends_page'))


    @app.route('/friends/delete/<int:friend_id>', methods=['POST'])
    @login_required
    def delete_friend(friend_id):
        friend = User.query.get(friend_id)
        if friend in current_user.friends:
            current_user.friends.remove(friend)
            friend.friends.remove(current_user)
            db.session.commit()
            flash(f"{friend.username} удален из друзей", "success")

        return redirect(url_for('friends_page'))


    @app.route('/api/search_users', methods=['GET'])
    @login_required
    def search_users():
        query = request.args.get('q', '').strip()
        if len(query) < 2:  # Не ищем при слишком коротком запросе
            return jsonify([])

        users = User.query.filter(
            User.username.ilike(f'%{query}%'),
            User.id != current_user.id
        ).limit(10).all()

        results = [{
            'id': user.id,
            'username': user.username,
            'avatar': user.avatar,
            'is_friend': user in current_user.friends
        } for user in users]

        return jsonify(results)


    @app.route('/create-calendar', methods=['GET', 'POST'])
    @login_required
    def create_calendar():
        if request.method == 'POST':
            name = request.form.get('name')
            is_team = request.form.get('type') == 'team'

            if not name:
                flash('Введите название календаря', 'danger')
                return redirect(url_for('create_calendar'))

            calendar = Calendar(
                name=name,
                owner_id=current_user.id,
                is_team=is_team
            )

            db.session.add(calendar)
            db.session.commit()

            flash(f'Календарь "{name}" успешно создан!', 'success')
            return redirect(url_for('view_calendar', calendar_id=calendar.id))

        return render_template('calendar/create_calendar.html')

    @app.route('/calendar/<int:calendar_id>')
    @login_required
    def view_calendar(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        # Проверка, что пользователь имеет доступ к календарю
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            abort(403)

        shifts = Shift.query.filter_by(calendar_id=calendar.id).order_by(Shift.start_time).all()
        friends = current_user.friends.all()  # Для добавления участников в командный календарь

        return render_template(
            'calendar/view_calendar.html',
            calendar=calendar,
            shifts=shifts,
            friends=friends,
            datetime=datetime  # Для использования в шаблоне
        )


    @app.route('/calendars')
    @login_required
    def my_calendars():
        personal_calendars = Calendar.query.filter_by(owner_id=current_user.id, is_team=False).all()
        team_calendars = Calendar.query.filter_by(owner_id=current_user.id, is_team=True).all()
        shared_calendars = current_user.shared_calendars

        return render_template('calendar/my_calendars.html',
                               personal_calendars=personal_calendars,
                               team_calendars=team_calendars,
                               shared_calendars=shared_calendars)

    @app.route('/calendar/<int:calendar_id>/add-shift', methods=['POST'])
    @login_required
    def add_shift(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        if calendar.owner_id != current_user.id:
            abort(403)

        title = request.form.get('title')
        start_time = request.form.get('start_time')
        end_time = request.form.get('end_time')
        user_id = request.form.get('user_id')

        try:
            shift = Shift(
                title=title,
                start_time=datetime.strptime(start_time, '%Y-%m-%dT%H:%M'),
                end_time=datetime.strptime(end_time, '%Y-%m-%dT%H:%M'),
                calendar_id=calendar.id,
                user_id=user_id if user_id else None
            )

            db.session.add(shift)
            db.session.commit()

            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/calendar/<int:calendar_id>/add-member', methods=['POST'])
    @login_required
    def add_calendar_member(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        if calendar.owner_id != current_user.id:
            abort(403)

        user_id = request.form.get('user_id')
        user = User.query.get_or_404(user_id)

        if user not in calendar.members:
            calendar.members.append(user)
            db.session.commit()

        return jsonify({'success': True})

    @app.route('/calendar/<int:calendar_id>/remove-member/<int:user_id>', methods=['POST'])
    @login_required
    def remove_calendar_member(calendar_id, user_id):
        calendar = Calendar.query.get_or_404(calendar_id)
        user = User.query.get_or_404(user_id)

        if calendar.owner_id != current_user.id:
            abort(403)

        if user in calendar.members:
            calendar.members.remove(user)
            db.session.commit()

        return redirect(url_for('view_calendar', calendar_id=calendar_id))

    @app.route('/calendar/<int:calendar_id>/delete', methods=['POST'])
    @login_required
    def delete_calendar(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        if calendar.owner_id != current_user.id:
            abort(403)

        db.session.delete(calendar)
        db.session.commit()

        flash('Календарь успешно удален', 'success')
        return redirect(url_for('my_calendars'))

    @app.route('/shift/<int:shift_id>/delete', methods=['POST'])
    @login_required
    def delete_shift(shift_id):
        shift = Shift.query.get_or_404(shift_id)
        calendar = shift.calendar

        if calendar.owner_id != current_user.id:
            abort(403)

        db.session.delete(shift)
        db.session.commit()

        return redirect(url_for('view_calendar', calendar_id=calendar.id))