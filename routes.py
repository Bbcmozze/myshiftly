from flask import render_template, request, redirect, url_for, flash, jsonify, abort
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User, generate_user_id, FriendRequest, Calendar, Shift, ShiftTemplate, calendar_members
from datetime import datetime, timedelta
from config import Config
from jinja2 import Environment
import os
from werkzeug.utils import secure_filename


def add_jinja2_filters(app):
    env = app.jinja_env
    env.filters['unique'] = lambda items: list(set(items))


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


    @app.route('/my-calendars')
    @login_required
    def my_calendars():
        # Получаем календари пользователя
        personal_calendars = Calendar.query.filter_by(owner_id=current_user.id, is_team=False).all()
        team_calendars = Calendar.query.filter_by(owner_id=current_user.id, is_team=True).all()
        shared_calendars = current_user.shared_calendars

        return render_template(
            'calendar/my_calendars.html',
            personal_calendars=personal_calendars,
            team_calendars=team_calendars,
            shared_calendars=shared_calendars
        )


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

        # Проверка доступа
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            abort(403)

        # Получаем месяц
        month = request.args.get('month')
        if month:
            try:
                current_month = datetime.strptime(month, '%Y-%m-%d').date().replace(day=1)
            except ValueError:
                current_month = datetime.utcnow().date().replace(day=1)
        else:
            current_month = datetime.utcnow().date().replace(day=1)

        # Получаем все дни месяца
        next_month = current_month.replace(day=28) + timedelta(days=4)
        last_day = next_month - timedelta(days=next_month.day)
        days_in_month = [current_month.replace(day=day) for day in range(1, last_day.day + 1)]

        # Получаем смены
        shifts = Shift.query.filter(
            Shift.calendar_id == calendar.id,
            Shift.date >= current_month,
            Shift.date <= last_day
        ).all()

        # Получаем шаблоны
        shift_templates = ShiftTemplate.query.filter_by(calendar_id=calendar.id).all()

        # Получаем друзей для добавления в календарь
        friends = current_user.friends.all()

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return render_template(
                'calendar/_calendar_table.html',  # Создайте этот шаблон с только таблицей
                calendar=calendar,
                shifts=shifts,
                current_month=current_month,
                days_in_month=days_in_month,
                datetime=datetime
            )
        else:
            return render_template(
                'calendar/view_calendar.html',
                calendar=calendar,
                shifts=shifts,
                shift_templates=shift_templates,
                friends=friends,
                current_month=current_month,
                days_in_month=days_in_month,
                datetime=datetime
            )


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
        date = request.form.get('date')

        try:
            shift = Shift(
                title=title,
                start_time=datetime.strptime(start_time, '%H:%M').time(),
                end_time=datetime.strptime(end_time, '%H:%M').time(),
                calendar_id=calendar.id,
                user_id=user_id,
                date=datetime.strptime(date, '%Y-%m-%d').date()
            )

            db.session.add(shift)
            db.session.commit()

            return jsonify({'success': True, 'shift_id': shift.id})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/calendar/<int:calendar_id>/add-members', methods=['POST'])
    @login_required
    def add_calendar_members(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        if calendar.owner_id != current_user.id:
            abort(403)

        data = request.get_json()
        user_ids = data.get('user_ids', [])
        added_members = []

        for user_id in user_ids:
            user = User.query.get(user_id)
            if user and user not in calendar.members and user.id != calendar.owner_id:
                calendar.members.append(user)
                added_members.append({
                    'id': user.id,
                    'username': user.username,
                    'avatar': user.avatar
                })

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Участники успешно добавлены',
            'added_members': added_members
        })

    @app.route('/calendar/<int:calendar_id>/remove-member/<int:user_id>', methods=['POST'])
    @login_required
    def remove_calendar_member(calendar_id, user_id):
        calendar = Calendar.query.get_or_404(calendar_id)
        user = User.query.get_or_404(user_id)

        if calendar.owner_id != current_user.id:
            abort(403)

        if user in calendar.members:
            # Удаляем все смены пользователя в этом календаре
            Shift.query.filter_by(calendar_id=calendar.id, user_id=user.id).delete()

            # Удаляем пользователя из календаря
            calendar.members.remove(user)
            db.session.commit()

            return jsonify({
                'success': True,
                'message': f'{user.username} удален из календаря'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Пользователь не является участником календаря'
            }), 400


    @app.route('/calendar/<int:calendar_id>/delete', methods=['POST'])
    @login_required
    def delete_calendar(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        if calendar.owner_id != current_user.id:
            abort(403)

        try:
            # Удаляем все связанные шаблоны вручную (на всякий случай)
            ShiftTemplate.query.filter_by(calendar_id=calendar.id).delete()
            # Удаляем все связанные смены
            Shift.query.filter_by(calendar_id=calendar.id).delete()
            # Удаляем связи с участниками
            db.session.execute(calendar_members.delete().where(calendar_members.c.calendar_id == calendar.id))

            db.session.delete(calendar)
            db.session.commit()
            flash('Календарь успешно удален', 'success')
        except Exception as e:
            db.session.rollback()
            flash('Ошибка при удалении календаря', 'danger')
            app.logger.error(f"Error deleting calendar: {str(e)}")

        return redirect(url_for('my_calendars'))

    @app.route('/shift/<int:shift_id>/delete', methods=['POST'])
    @login_required
    def delete_shift(shift_id):
        shift = Shift.query.get_or_404(shift_id)
        if shift.calendar.owner_id != current_user.id:
            abort(403)

        calendar_id = shift.calendar_id
        db.session.delete(shift)
        db.session.commit()

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': True})
        else:
            flash('Смена успешно удалена', 'success')
            return redirect(url_for('view_calendar', calendar_id=calendar_id))


    @app.route('/api/create_shift_template', methods=['POST'])
    @login_required
    def create_shift_template():
        data = request.get_json()

        try:
            calendar = Calendar.query.get(data['calendar_id'])
            if not calendar or (calendar.owner_id != current_user.id and current_user not in calendar.members):
                return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

            template = ShiftTemplate(
                title=data['title'],
                start_time=datetime.strptime(data['start_time'], '%H:%M').time(),
                end_time=datetime.strptime(data['end_time'], '%H:%M').time(),
                calendar_id=data['calendar_id'],
                owner_id=current_user.id
            )

            db.session.add(template)
            db.session.commit()

            return jsonify({
                'success': True,
                'template': {
                    'id': template.id,
                    'title': template.title,
                    'start_time': template.start_time.strftime('%H:%M'),
                    'end_time': template.end_time.strftime('%H:%M')
                }
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 400

    @app.route('/api/add_shift_from_template', methods=['POST'])
    @login_required
    def add_shift_from_template():
        data = request.get_json()

        try:
            calendar = Calendar.query.get(data['calendar_id'])
            if not calendar or (calendar.owner_id != current_user.id and current_user not in calendar.members):
                return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

            template = ShiftTemplate.query.get(data['template_id'])
            if not template:
                return jsonify({'success': False, 'error': 'Шаблон не найден'}), 404

            if template.calendar_id != calendar.id:
                return jsonify({'success': False, 'error': 'Неверный шаблон'}), 400

            user = User.query.get(data['user_id'])
            if not user or (user.id != current_user.id and user not in calendar.members):
                return jsonify({'success': False, 'error': 'Неверный пользователь'}), 400

            # Проверяем, есть ли уже смена в этот день у этого пользователя
            existing_shift = Shift.query.filter_by(
                calendar_id=data['calendar_id'],
                user_id=data['user_id'],
                date=datetime.strptime(data['date'], '%Y-%m-%d').date()
            ).first()

            if existing_shift:
                return jsonify({
                    'success': False,
                    'error': 'У пользователя уже есть смена в этот день'
                }), 400

            shift = Shift(
                title=template.title,
                start_time=template.start_time,
                end_time=template.end_time,
                date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
                calendar_id=data['calendar_id'],
                user_id=data['user_id']
            )

            db.session.add(shift)
            db.session.commit()  # Явное сохранение

            return jsonify({
                'success': True,
                'shift': {
                    'id': shift.id,
                    'title': shift.title,
                    'start_time': shift.start_time.strftime('%H:%M'),
                    'end_time': shift.end_time.strftime('%H:%M'),
                    'date': shift.date.strftime('%Y-%m-%d')
                }
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/delete_shift_template/<int:template_id>', methods=['DELETE'])
    @login_required
    def delete_shift_template(template_id):
        template = ShiftTemplate.query.get_or_404(template_id)

        # Проверка прав доступа
        if template.owner_id != current_user.id:
            abort(403)

        try:
            # Получаем ID связанных смен перед удалением
            related_shift_ids = [
                shift.id for shift in
                Shift.query.filter_by(template_id=template_id).all()
            ]

            # Удаляем шаблон
            db.session.delete(template)
            db.session.commit()

            return jsonify({
                'success': True,
                'deleted_shift_ids': related_shift_ids  # Отправляем клиенту
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500