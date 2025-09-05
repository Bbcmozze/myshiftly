import traceback
import logging
from flask import render_template, request, redirect, url_for, flash, jsonify, abort
from sqlalchemy import exists, and_, or_, extract
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User, generate_user_id, generate_calendar_id, FriendRequest, Calendar, Shift, ShiftTemplate, calendar_members, Group, group_members

from datetime import datetime, timedelta, timezone
from config import Config
from jinja2 import Environment
import os
from werkzeug.utils import secure_filename
from zoneinfo import ZoneInfo


def add_jinja2_filters(app):
    env = app.jinja_env
    env.filters['unique'] = lambda items: list(set(items))
    
    # Фильтр: конвертация времени в MSK и опциональное форматирование
    def to_msk(value, fmt: str | None = None):
        try:
            if not isinstance(value, datetime):
                return value
            # Если naive — считаем, что это UTC из БД
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            msk = value.astimezone(ZoneInfo('Europe/Moscow'))
            return msk.strftime(fmt) if fmt else msk
        except Exception:
            return value

    env.filters['to_msk'] = to_msk


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
            username = (request.form.get('username') or '').strip()
            email = (request.form.get('email') or '').strip()
            password = request.form.get('password')
            confirm_password = request.form.get('confirm_password')
            first_name = (request.form.get('first_name') or '').strip()
            last_name = (request.form.get('last_name') or '').strip()

            # Проверка длины пароля
            if len(password) < 8:
                flash('Пароль должен содержать не менее 8 символов', 'danger')
                return redirect(url_for('register'))

            if password != confirm_password:
                flash('Пароли не совпадают', 'danger')
                return redirect(url_for('register'))

            # Имя и Фамилия обязательны
            if not first_name or not last_name:
                flash('Имя и Фамилия должны быть заполнены', 'danger')
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
                password_hash=hashed_password,
                first_name=first_name,
                last_name=last_name
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

        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

        if not user or user.id == current_user.id:
            message = "Пользователь не найден"
            if is_ajax:
                return jsonify({"success": False, "status": "invalid", "message": message}), 400
            flash(message, "danger")
            return redirect(url_for('friends_page'))

        if user in current_user.friends:
            message = "Этот пользователь уже в вашем списке друзей"
            if is_ajax:
                return jsonify({"success": False, "status": "already_friends", "message": message}), 200
            flash(message, "danger")
            return redirect(url_for('friends_page'))

        existing_request = FriendRequest.query.filter_by(sender_id=current_user.id, receiver_id=user.id).first()
        if not existing_request:
            request_obj = FriendRequest(sender_id=current_user.id, receiver_id=user.id)
            db.session.add(request_obj)
            db.session.commit()
            message = "Запрос отправлен"
            if is_ajax:
                return jsonify({
                    "success": True,
                    "status": "sent",
                    "message": message,
                    "user": {"id": user.id, "username": user.username}
                })
            flash(message, "success")
            return redirect(url_for('friends_page'))
        else:
            message = "Вы уже отправили запрос этому пользователю"
            if is_ajax:
                return jsonify({"success": True, "status": "already_sent", "message": message}), 200
            flash(message, "info")
            return redirect(url_for('friends_page'))


    @app.route('/friends/requests', methods=['POST'])
    @login_required
    def handle_friend_request():
        action = request.form.get('action')
        request_id = request.form.get('request_id')
        friend_request = FriendRequest.query.get(request_id)

        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

        if not friend_request or friend_request.receiver_id != current_user.id:
            if is_ajax:
                return jsonify({"success": False, "message": "Запрос не найден"}), 404
            return redirect(url_for('friends_page'))

        sender = User.query.get(friend_request.sender_id)
        if action == 'accept':
            current_user.friends.append(sender)
            sender.friends.append(current_user)
            message = f"Вы теперь друзья с {sender.username}"
            status = 'accepted'
        else:
            message = f"Запрос от {sender.username} отклонен"
            status = 'rejected'

        db.session.delete(friend_request)
        db.session.commit()

        if is_ajax:
            # Возвращаем расширенную информацию и актуальное количество друзей
            friends_count = current_user.friends.count()
            return jsonify({
                "success": True,
                "status": status,
                "message": message,
                "friends_count": friends_count,
                "sender": {
                    "id": sender.id,
                    "username": sender.username,
                    "first_name": sender.first_name,
                    "last_name": sender.last_name,
                    "avatar": sender.avatar
                }
            })

        flash(message, "success" if status == 'accepted' else "info")
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
        raw_query = request.args.get('q', '').strip()
        if len(raw_query) < 2:  # Не ищем при слишком коротком запросе
            return jsonify([])

        # Поддержка ввода в формате @username
        query = raw_query[1:] if raw_query.startswith('@') else raw_query

        users_query = User.query

        # Если введено несколько слов, требуем, чтобы каждое вхождение
        # присутствовало хотя бы в одном из полей (username/first_name/last_name)
        if ' ' in query:
            tokens = [t for t in query.split() if t]
            for t in tokens:
                users_query = users_query.filter(
                    or_(
                        User.username.ilike(f'%{t}%'),
                        User.first_name.ilike(f'%{t}%'),
                        User.last_name.ilike(f'%{t}%')
                    )
                )
        else:
            q = query
            users_query = users_query.filter(
                or_(
                    User.username.ilike(f'%{q}%'),
                    # Поддержка поиска по полному имени в обоих порядках
                    (User.last_name + ' ' + User.first_name).ilike(f'%{q}%'),
                    (User.first_name + ' ' + User.last_name).ilike(f'%{q}%'),
                    User.first_name.ilike(f'%{q}%'),
                    User.last_name.ilike(f'%{q}%')
                )
            )

        users = users_query.filter(User.id != current_user.id).limit(10).all()

        results = []
        for user in users:
            is_friend = user in current_user.friends
            outgoing = FriendRequest.query.filter_by(sender_id=current_user.id, receiver_id=user.id).first() is not None
            incoming = FriendRequest.query.filter_by(sender_id=user.id, receiver_id=current_user.id).first() is not None

            if is_friend:
                request_status = 'friends'
            elif outgoing:
                request_status = 'outgoing_pending'
            elif incoming:
                request_status = 'incoming_pending'
            else:
                request_status = 'none'

            results.append({
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'avatar': user.avatar,
                'is_friend': is_friend,
                'request_status': request_status
            })

        return jsonify(results)

    @app.route('/api/friend_requests', methods=['GET'])
    @login_required
    def api_friend_requests():
        # Текущие входящие заявки для пользователя
        reqs = FriendRequest.query.filter_by(receiver_id=current_user.id).order_by(FriendRequest.timestamp.desc()).all()
        items = []
        for r in reqs:
            sender = r.sender
            items.append({
                'id': r.id,
                'timestamp': (r.timestamp.isoformat() if r.timestamp else None),
                'sender': {
                    'id': sender.id,
                    'username': sender.username,
                    'first_name': sender.first_name,
                    'last_name': sender.last_name,
                    'avatar': sender.avatar
                }
            })
        return jsonify({
            'count': len(items),
            'items': items
        })


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

            # Генерируем уникальный 8-значный ID календаря
            calendar_id = generate_calendar_id()
            while Calendar.query.get(calendar_id):
                calendar_id = generate_calendar_id()

            calendar = Calendar(
                id=calendar_id,
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

        # Получаем участников с позициями
        members_with_positions = []

        # Добавляем владельца с позицией 0
        owner = User.query.get(calendar.owner_id)
        members_with_positions.append((owner, 0))

        # Добавляем остальных участников с их позициями
        other_members = db.session.query(
            User,
            calendar_members.c.position
        ).join(
            calendar_members,
            (calendar_members.c.user_id == User.id) &
            (calendar_members.c.calendar_id == calendar.id)
        ).order_by(calendar_members.c.position).all()

        members_with_positions.extend(other_members)

        # Создаем списки для передачи в шаблон
        members_sorted = [m[0] for m in members_with_positions]
        member_positions = {m[0].id: m[1] for m in members_with_positions}

        # Получаем смены с информацией о шаблонах
        shifts_with_templates = db.session.query(
            Shift,
            ShiftTemplate.show_time,
            ShiftTemplate.color_class  # Добавьте это поле
        ).outerjoin(
            ShiftTemplate,
            Shift.template_id == ShiftTemplate.id
        ).filter(
            Shift.calendar_id == calendar.id,
            Shift.date >= current_month,
            Shift.date <= last_day
        ).all()

        # Преобразуем смены в удобный формат для шаблона
        shifts = []
        for shift, template_show_time, template_color_class in shifts_with_templates:
            show_time = template_show_time if template_show_time is not None else True
            color_class = template_color_class if template_color_class else 'badge-color-1'
            shifts.append({
                'id': shift.id,
                'title': shift.title,
                'start_time': shift.start_time.strftime('%H:%M'),
                'end_time': shift.end_time.strftime('%H:%M'),
                'date': shift.date,
                'user_id': shift.user_id,
                'show_time': shift.show_time,
                'color_class': shift.color_class
            })

        # Получаем шаблоны
        shift_templates = ShiftTemplate.query.filter_by(calendar_id=calendar.id).all()

        # Получаем группы календаря
        groups = Group.query.filter_by(calendar_id=calendar.id).all()
        
        # Создаем словарь для быстрого поиска групп пользователей
        user_groups = {}
        for group in groups:
            for member in group.members:
                if member.id not in user_groups:
                    user_groups[member.id] = []
                user_groups[member.id].append(group)

        return render_template(
            'calendar/view_calendar.html',
            calendar=calendar,
            current_user=current_user,
            shifts=shifts,  # Теперь передаем список словарей вместо объектов Shift
            shift_templates=shift_templates,
            current_month=current_month,
            days_in_month=days_in_month,
            datetime=datetime,
            members_sorted=members_sorted,
            member_positions=member_positions,
            is_owner=(calendar.owner_id == current_user.id),
            groups=groups,
            user_groups=user_groups
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

        # Получаем текущую максимальную позицию
        max_position = db.session.query(db.func.max(calendar_members.c.position)).filter(
            calendar_members.c.calendar_id == calendar.id
        ).scalar() or 0

        # Назначаем уникальные возрастающие позиции для каждого добавляемого пользователя
        for idx, user_id in enumerate(user_ids, start=1):
            user = User.query.get(user_id)
            if not user:
                return jsonify({'success': False, 'message': f'Пользователь с ID {user_id} не найден'}), 400

            if user not in calendar.members:
                new_position = max_position + idx
                db.session.execute(calendar_members.insert().values(
                    calendar_id=calendar.id,
                    user_id=user.id,
                    position=new_position
                ))
                added_members.append({
                    'id': user.id,
                    'username': user.username,
                    'avatar': user.avatar,
                    'position': new_position
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
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
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
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': True, 'message': 'Календарь успешно удален'})
            else:
                flash('Календарь успешно удален', 'success')
                return redirect(url_for('my_calendars'))
                
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting calendar: {str(e)}")
            
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'error': 'Ошибка при удалении календаря'}), 500
            else:
                flash('Ошибка при удалении календаря', 'danger')
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
            template = ShiftTemplate(
                title=data['title'],
                start_time=datetime.strptime(data['start_time'], '%H:%M').time(),
                end_time=datetime.strptime(data['end_time'], '%H:%M').time(),
                calendar_id=data['calendar_id'],
                owner_id=current_user.id,
                show_time=data.get('show_time', True),
                color_class=data.get('color_class', 'badge-color-1')  # Убедитесь, что цвет сохраняется
            )
            db.session.add(template)
            db.session.commit()

            return jsonify({
                'success': True,
                'template': {
                    'id': template.id,
                    'title': template.title,
                    'start_time': template.start_time.strftime('%H:%M'),
                    'end_time': template.end_time.strftime('%H:%M'),
                    'show_time': template.show_time,
                    'color_class': template.color_class  # Возвращаем цвет
                }
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @app.route('/api/add_shift_from_template', methods=['POST'])
    @login_required
    def add_shift_from_template():
        data = request.get_json()
        try:
            calendar = Calendar.query.get(data['calendar_id'])
            if not calendar or (calendar.owner_id != current_user.id and current_user not in calendar.members):
                return jsonify({'success': False, 'error': 'Доступ запрещён'}), 403

            template = ShiftTemplate.query.get(data['template_id'])
            if not template:
                return jsonify({'success': False, 'error': 'Шаблон не найден'}), 404

            user = User.query.get(data['user_id'])
            if not user or (user.id != current_user.id and user not in calendar.members):
                return jsonify({'success': False, 'error': 'Неверный пользователь'}), 400

            # Проверяем существующую смену
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

            # Создаём смену с цветом из шаблона
            shift = Shift(
                title=template.title,
                start_time=template.start_time,
                end_time=template.end_time,
                date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
                calendar_id=data['calendar_id'],
                user_id=data['user_id'],
                template_id=template.id,
                show_time=template.show_time,
                color_class=template.color_class  # Передаём цвет из шаблона
            )

            db.session.add(shift)
            db.session.commit()

            return jsonify({
                'success': True,
                'shift': {
                    'id': shift.id,
                    'title': shift.title,
                    'start_time': shift.start_time.strftime('%H:%M'),
                    'end_time': shift.end_time.strftime('%H:%M'),
                    'show_time': shift.show_time,
                    'color_class': shift.color_class  # Возвращаем цвет смены
                }
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/delete_shift_template/<int:template_id>', methods=['DELETE'])
    @login_required
    def delete_shift_template(template_id):
        template = ShiftTemplate.query.get_or_404(template_id)

        # Проверка прав доступа
        if template.owner_id != current_user.id:
            abort(403)

        try:
            # Получаем ID связанных смен перед удалением
            related_shifts = Shift.query.filter_by(template_id=template_id).all()
            related_shift_ids = [shift.id for shift in related_shifts]

            # Обновляем color_class у связанных смен, сохраняя их текущий цвет
            for shift in related_shifts:
                shift.color_class = template.color_class  # Сохраняем цвет из шаблона
                shift.template_id = None  # Отвязываем от шаблона

            db.session.commit()  # Сохраняем изменения в сменах

            # Теперь удаляем шаблон
            db.session.delete(template)
            db.session.commit()

            return jsonify({
                'success': True,
                'deleted_shift_ids': related_shift_ids,
                'message': 'Шаблон удалён, цвет смен сохранён'
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/get_friends', methods=['GET'])
    @login_required
    def get_friends():
        friends = current_user.friends.all()
        results = [{
            'id': friend.id,
            'username': friend.username,
            'first_name': friend.first_name,
            'last_name': friend.last_name,
            'avatar': friend.avatar,
            'created_at': friend.created_at.isoformat() if friend.created_at else None
        } for friend in friends]
        return jsonify(results)

    @app.route('/analysis')
    @login_required
    def analysis():
        # Получаем календари пользователя (владелец или участник)
        owned_calendars = Calendar.query.filter_by(owner_id=current_user.id).all()
        shared_calendars = current_user.shared_calendars
        
        # Объединяем все календари
        all_calendars = list(owned_calendars) + list(shared_calendars)
        
        # Убираем дубликаты
        unique_calendars = []
        seen_ids = set()
        for calendar in all_calendars:
            if calendar.id not in seen_ids:
                unique_calendars.append(calendar)
                seen_ids.add(calendar.id)
        
        # Определяем роль пользователя для каждого календаря
        calendar_roles = {}
        for calendar in unique_calendars:
            calendar_roles[calendar.id] = 'creator' if calendar.owner_id == current_user.id else 'participant'
        
        current_month = datetime.utcnow().date().replace(day=1)
        
        return render_template(
            'Analysis/analysis.html',
            calendars=unique_calendars,
            calendar_roles=calendar_roles,
            current_month=current_month
        )

    @app.route('/api/analysis-debug', methods=['GET'])
    @login_required
    def analysis_debug():
        """Debug endpoint to test basic functionality"""
        try:
            user_calendars = Calendar.query.filter_by(owner_id=current_user.id).all()
            shared_calendars = current_user.shared_calendars
            
            return jsonify({
                'user_id': current_user.id,
                'owned_calendars': [{'id': c.id, 'name': c.name} for c in user_calendars],
                'shared_calendars': [{'id': c.id, 'name': c.name} for c in shared_calendars],
                'status': 'ok'
            })
        except Exception as e:
            import traceback
            return jsonify({
                'error': str(e),
                'traceback': traceback.format_exc(),
                'status': 'error'
            }), 500

    @app.route('/api/analysis-data', methods=['POST'])
    @login_required
    def get_analysis_data():
        try:
            data = request.get_json()
            if not data:
                app.logger.error("No JSON data received")
                return jsonify({'error': 'No data provided'}), 400
                
            period = data.get('period', 'month')
            month = data.get('month', datetime.utcnow().strftime('%Y-%m'))
            calendar_ids = data.get('calendar_ids', [])
            filters = data.get('filters', {})
            comparison = data.get('comparison')
            
            app.logger.info(f"Analysis request: period={period}, month={month}, calendars={calendar_ids}, filters={filters}")
            
            if not calendar_ids:
                return jsonify({'error': 'No calendars selected'}), 400
            
            accessible_calendars = []
            user_calendar_roles = {}  # Track user's role in each calendar
            for calendar_id in calendar_ids:
                try:
                    calendar = Calendar.query.get(calendar_id)
                    if calendar and (calendar.owner_id == current_user.id or current_user in calendar.members):
                        accessible_calendars.append(calendar_id)
                        user_calendar_roles[calendar_id] = 'creator' if calendar.owner_id == current_user.id else 'participant'
                except Exception as e:
                    app.logger.error(f"Error checking calendar {calendar_id}: {str(e)}")
            
            if not accessible_calendars:
                return jsonify({'error': 'No accessible calendars'}), 403
            
            try:
                if period == 'week':
                    start_date, end_date = get_week_range(month)
                elif period == 'quarter':
                    start_date, end_date = get_quarter_range(month)
                elif period == 'year':
                    start_date, end_date = get_year_range(month)
                else:
                    start_date, end_date = get_month_range(month)
                
                app.logger.info(f"Date range: {start_date} to {end_date}")
                
                analysis_data = {}
                
                # Calculate each section separately with error handling
                try:
                    analysis_data['shift_stats'] = calculate_shift_stats(accessible_calendars, start_date, end_date, filters, current_user.id, user_calendar_roles)
                except Exception as e:
                    app.logger.error(f"Error in shift_stats: {str(e)}")
                    analysis_data['shift_stats'] = {'total_hours': 0, 'total_shifts': 0, 'avg_duration': 0, 'top_template': None}
                
                try:
                    analysis_data['team_analysis'] = calculate_team_analysis(accessible_calendars, start_date, end_date, filters, current_user.id, user_calendar_roles)
                except Exception as e:
                    app.logger.error(f"Error in team_analysis: {str(e)}")
                    analysis_data['team_analysis'] = {'activity_ranking': [], 'coverage_data': [], 'workload_balance': {'labels': [], 'values': []}}
                
                try:
                    analysis_data['time_slots'] = calculate_time_slots(accessible_calendars, start_date, end_date, filters, current_user.id, user_calendar_roles)
                except Exception as e:
                    app.logger.error(f"Error in time_slots: {str(e)}")
                    analysis_data['time_slots'] = {'morning': {'percentage': 0}, 'day': {'percentage': 0}, 'evening': {'percentage': 0}, 'night': {'percentage': 0}}
                
                try:
                    analysis_data['work_time_distribution'] = calculate_work_time_distribution(accessible_calendars, start_date, end_date, filters, current_user.id, user_calendar_roles)
                except Exception as e:
                    app.logger.error(f"Error in work_time_distribution: {str(e)}")
                    analysis_data['work_time_distribution'] = {'labels': [], 'values': []}
                
                try:
                    analysis_data['weekday_activity'] = calculate_weekday_activity(accessible_calendars, start_date, end_date, filters, current_user.id, user_calendar_roles)
                except Exception as e:
                    app.logger.error(f"Error in weekday_activity: {str(e)}")
                    analysis_data['weekday_activity'] = {'hours': [0] * 7}
                
                try:
                    analysis_data['trends_data'] = calculate_trends_data(accessible_calendars, period, month, filters, current_user.id, user_calendar_roles)
                except Exception as e:
                    app.logger.error(f"Error in trends_data: {str(e)}")
                    analysis_data['trends_data'] = {'hours': {'labels': [], 'values': []}, 'shifts': {'labels': [], 'values': []}, 'people': {'labels': [], 'values': []}}
                
                # Add comparison data if requested
                if comparison:
                    try:
                        comp_period = comparison.get('period', 'month')
                        comp_month = comparison.get('month')
                        
                        if comp_period == 'week':
                            comp_start_date, comp_end_date = get_week_range(comp_month)
                        elif comp_period == 'quarter':
                            comp_start_date, comp_end_date = get_quarter_range(comp_month)
                        elif comp_period == 'year':
                            comp_start_date, comp_end_date = get_year_range(comp_month)
                        else:
                            comp_start_date, comp_end_date = get_month_range(comp_month)
                        
                        analysis_data['comparison'] = {
                            'shift_stats': calculate_shift_stats(accessible_calendars, comp_start_date, comp_end_date, filters, current_user.id, user_calendar_roles),
                            'team_analysis': calculate_team_analysis(accessible_calendars, comp_start_date, comp_end_date, filters, current_user.id, user_calendar_roles),
                            'time_slots': calculate_time_slots(accessible_calendars, comp_start_date, comp_end_date, filters, current_user.id, user_calendar_roles),
                            'work_time_distribution': calculate_work_time_distribution(accessible_calendars, comp_start_date, comp_end_date, filters, current_user.id, user_calendar_roles),
                            'weekday_activity': calculate_weekday_activity(accessible_calendars, comp_start_date, comp_end_date, filters, current_user.id, user_calendar_roles),
                            'trends_data': calculate_trends_data(accessible_calendars, comp_period, comp_month, filters, current_user.id, user_calendar_roles)
                        }
                    except Exception as e:
                        app.logger.error(f"Error in comparison data: {str(e)}")
                        analysis_data['comparison'] = None
                
                return jsonify(analysis_data)
            
            except Exception as e:
                app.logger.error(f"Error in date calculation or analysis: {str(e)}")
                import traceback
                app.logger.error(traceback.format_exc())
                return jsonify({'error': f'Analysis calculation failed: {str(e)}'}), 500
        
        except Exception as e:
            app.logger.error(f"Critical error in get_analysis_data: {str(e)}")
            import traceback
            app.logger.error(traceback.format_exc())
            return jsonify({'error': f'Server error: {str(e)}'}), 500

    @app.route('/api/calendar-users', methods=['POST'])
    @login_required
    def get_calendar_users():
        data = request.get_json()
        calendar_ids = data.get('calendar_ids', [])
        
        if not calendar_ids:
            return jsonify([])
        
        try:
            users = {}
            for calendar_id in calendar_ids:
                calendar = Calendar.query.get(calendar_id)
                if calendar and (calendar.owner_id == current_user.id or current_user in calendar.members):
                    # Add owner
                    owner = calendar.owner
                    users[owner.id] = {
                        'id': owner.id,
                        'username': owner.username,
                        'first_name': owner.first_name,
                        'last_name': owner.last_name,
                        'avatar': owner.avatar
                    }
                    # Add members
                    for member in calendar.members:
                        users[member.id] = {
                            'id': member.id,
                            'username': member.username,
                            'first_name': member.first_name,
                            'last_name': member.last_name,
                            'avatar': member.avatar
                        }
            
            return jsonify(list(users.values()))
        
        except Exception as e:
            app.logger.error(f"Error getting calendar users: {str(e)}")
            return jsonify([])

    @app.route('/api/calendar-shift-types', methods=['POST'])
    @login_required
    def get_calendar_shift_types():
        data = request.get_json()
        calendar_ids = data.get('calendar_ids', [])
        
        if not calendar_ids:
            return jsonify([])
        
        # Проверяем доступ к календарям
        accessible_calendars = []
        for calendar_id in calendar_ids:
            calendar = Calendar.query.get(calendar_id)
            if calendar and (calendar.owner_id == current_user.id or current_user in calendar.members):
                accessible_calendars.append(calendar_id)
        
        if not accessible_calendars:
            return jsonify([])
        
        try:
            # Получаем уникальные типы смен из ShiftTemplate
            template_types = (
                db.session.query(ShiftTemplate.color_class, ShiftTemplate.title)
                .filter(ShiftTemplate.calendar_id.in_(accessible_calendars))
                .distinct()
                .all()
            )
            
            # Получаем уникальные типы смен из Shift
            shift_types = (
                db.session.query(Shift.color_class, Shift.title)
                .filter(Shift.calendar_id.in_(accessible_calendars))
                .distinct()
                .all()
            )
            
            # Объединяем и убираем дубликаты
            all_types = {}
            for color_class, title in template_types + shift_types:
                if color_class and color_class not in all_types:
                    all_types[color_class] = title
            
            # Преобразуем в список с дополнительной информацией
            result = []
            for color_class, title in all_types.items():
                # Получаем hex цвет из CSS класса
                color_map = {
                    'red': '#dc3545',
                    'blue': '#007bff', 
                    'green': '#28a745',
                    'yellow': '#ffc107',
                    'purple': '#6f42c1',
                    'orange': '#fd7e14',
                    'pink': '#e83e8c',
                    'cyan': '#17a2b8',
                    'gray': '#6c757d',
                    'dark': '#343a40'
                }
                
                result.append({
                    'color_class': color_class,
                    'title': title or color_class.title(),
                    'color': color_map.get(color_class, '#6c757d')
                })
            
            return jsonify(result)
            
        except Exception as e:
            app.logger.error(f"Error getting calendar shift types: {str(e)}")
            return jsonify([])

    @app.route('/calendar/<int:calendar_id>/members', methods=['GET'])
    @login_required
    def get_calendar_members_route(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        # Проверка доступа
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            abort(403)

        # Возвращаем участников с их позицией из calendar_members, отсортированных по позиции (возрастание)
        # Владелец не включается (для групп он не нужен)
        rows = (
            db.session.query(User.id, User.username, User.first_name, User.last_name, User.avatar, calendar_members.c.position)
            .join(calendar_members, (calendar_members.c.user_id == User.id) & (calendar_members.c.calendar_id == calendar.id))
            .order_by(calendar_members.c.position.asc(), User.id.asc())
            .all()
        )

        members = [
            {
                'id': r.id,
                'username': r.username,
                'first_name': r.first_name,
                'last_name': r.last_name,
                'avatar': r.avatar,
                'position': int(r.position) if r.position is not None else None,
            }
            for r in rows
        ]

        return jsonify(members)

    @app.route('/api/get_calendar_groups/<int:calendar_id>', methods=['GET'])
    @login_required
    def get_calendar_groups_route(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

        # Возвращаем группы в порядке позиции (новые выше), при равной позиции — по id (новые выше)
        groups = (
            Group.query
            .filter_by(calendar_id=calendar_id)
            .order_by(Group.position.desc(), Group.id.desc())
            .all()
        )
        groups_data = []
        
        for group in groups:
            groups_data.append({
                'id': group.id,
                'name': group.name,
                'color': group.color,
                'owner_id': group.owner_id,
                'position': group.position,
                'members': [
                    {
                        'id': m.id,
                        'username': m.username,
                        'first_name': m.first_name,
                        'last_name': m.last_name,
                        'avatar': m.avatar
                    } for m in group.members
                ]
            })

        return jsonify({'success': True, 'groups': groups_data})

    @app.route('/calendar/<int:calendar_id>/shifts', methods=['GET'])
    @login_required
    def get_calendar_shifts(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        # Проверка доступа
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            abort(403)

        # Получаем месяц из параметров запроса
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

        shifts = Shift.query.filter(
            Shift.calendar_id == calendar_id,
            Shift.date >= current_month,
            Shift.date <= last_day
        ).all()

        # Формируем список смен
        shifts_data = []
        for shift in shifts:
            shift_data = {
                'id': shift.id,
                'user_id': shift.user_id,
                'date': shift.date.strftime('%Y-%m-%d'),
                'title': shift.title,
                'color_class': shift.color_class,
                'show_time': shift.show_time
            }
            
            if shift.show_time and shift.start_time and shift.end_time:
                shift_data['start_time'] = shift.start_time.strftime('%H:%M')
                shift_data['end_time'] = shift.end_time.strftime('%H:%M')
            
            shifts_data.append(shift_data)

        return jsonify(shifts_data)

    @app.route('/api/create_group', methods=['POST'])
    @login_required
    def create_group():
        data = request.get_json()
        calendar_id = data.get('calendar_id')
        name = data.get('name')
        color = data.get('color', 'badge-color-1')
        user_ids = data.get('user_ids', [])

        calendar = Calendar.query.get_or_404(calendar_id)
        if calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

        try:
            # Получаем максимальную позицию для групп в этом календаре
            max_position = db.session.query(db.func.max(Group.position)).filter(
                Group.calendar_id == calendar_id
            ).scalar() or 0
            
            # Новая группа получает позицию на 1 больше максимальной
            new_position = max_position + 1
            
            group = Group(
                name=name,
                color=color,
                calendar_id=calendar_id,
                owner_id=current_user.id,
                position=new_position
            )
            db.session.add(group)
            db.session.flush()  # Получаем ID группы

            # Добавляем участников в группу (исключаем создателя календаря)
            for user_id in user_ids:
                user = User.query.get(user_id)
                if user and user in calendar.members and user.id != calendar.owner_id:
                    group.members.append(user)

            db.session.commit()

            return jsonify({
                'success': True,
                'group': {
                    'id': group.id,
                    'name': group.name,
                    'color': group.color,
                    'position': group.position,
                    'members': [
                        {
                            'id': m.id,
                            'username': m.username,
                            'first_name': m.first_name,
                            'last_name': m.last_name,
                            'avatar': m.avatar
                        } for m in group.members
                    ]
                }
            })

        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/calendar/<int:calendar_id>/update-positions', methods=['POST'])
    @login_required
    def update_calendar_positions(calendar_id):
        if not request.is_json:
            return jsonify({'success': False, 'error': 'Invalid content type'}), 400

        calendar = Calendar.query.get_or_404(calendar_id)

        if calendar.owner_id != current_user.id:
                return jsonify({
                    'success': False,
                    'error': 'Forbidden',
                    'message': 'Только владелец календаря может изменять порядок участников'
                }), 403

        try:
            data = request.get_json() or {}
            # Поддерживаем оба формата: { "positions": {"<uid>": pos} } и {"<uid>": pos}
            positions = data.get('positions') if isinstance(data, dict) and 'positions' in data else data

            if not isinstance(positions, dict) or not positions:
                return jsonify({'success': False, 'error': 'Empty positions data'}), 400

            # Приводим ключи и значения к int и валидируем
            try:
                normalized = {int(uid): int(pos) for uid, pos in positions.items()}
            except Exception:
                return jsonify({'success': False, 'error': 'Positions must be a dict of {user_id:int -> position:int}'}), 400

            valid_user_ids = {m.id for m in calendar.members}
            for uid in normalized.keys():
                if uid not in valid_user_ids:
                    return jsonify({'success': False, 'error': f'Invalid user ID: {uid}'}), 400

            # Обновляем позиции по одной записи
            for uid, pos in normalized.items():
                db.session.execute(
                    calendar_members.update()
                    .where(calendar_members.c.calendar_id == calendar.id)
                    .where(calendar_members.c.user_id == uid)
                    .values(position=pos)
                )

            db.session.commit()

            return jsonify({
                'success': True,
                'message': 'Positions updated successfully',
                'updated_count': len(normalized)
            })

        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/update_group_positions/<int:calendar_id>', methods=['POST'])
    @login_required
    def update_group_positions(calendar_id):
        """Обновляет порядок групп в календаре.
        Ожидает JSON вида { "order": [group_id_top, group_id_next, ...] }
        Позиции присваиваются так, чтобы первый элемент имел наибольшую позицию (для order_by desc).
        """
        calendar = Calendar.query.get_or_404(calendar_id)
        if calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Изменять порядок групп может только владелец календаря'}), 403

        data = request.get_json(silent=True) or {}
        order = data.get('order')
        if not isinstance(order, list) or not all(isinstance(i, int) for i in order):
            return jsonify({'success': False, 'error': 'Некорректный формат данных'}), 400

        # Получаем все группы календаря
        groups = Group.query.filter_by(calendar_id=calendar_id).all()
        group_map = {g.id: g for g in groups}

        # Фильтруем входной порядок только по существующим группам этого календаря
        filtered_order = [gid for gid in order if gid in group_map]
        if not filtered_order:
            return jsonify({'success': False, 'error': 'Список групп пуст или неверен'}), 400

        try:
            # Максимальная позиция присваивается верхнему элементу
            max_pos = len(filtered_order)
            for idx, gid in enumerate(filtered_order):
                group_map[gid].position = max_pos - idx

            db.session.commit()
            return jsonify({'success': True})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/update_group/<int:group_id>', methods=['PUT'])
    @login_required
    def update_group(group_id):
        group = Group.query.get_or_404(group_id)
        
        # Проверяем права доступа
        if group.owner_id != current_user.id and group.calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
        
        data = request.get_json()
        name = data.get('name')
        color = data.get('color')
        user_ids = data.get('user_ids', [])
        
        if not name:
            return jsonify({'success': False, 'error': 'Название группы обязательно'}), 400
        
        try:
            # Обновляем название и цвет группы
            group.name = name
            if color:
                group.color = color
            
            # Получаем текущих участников группы
            current_members = set(m.id for m in group.members)
            new_members = set(user_ids)
            
            # Удаляем участников, которых нет в новом списке
            to_remove = current_members - new_members
            for user_id in to_remove:
                user = User.query.get(user_id)
                if user and user in group.members:
                    group.members.remove(user)
            
            # Добавляем новых участников
            to_add = new_members - current_members
            for user_id in to_add:
                user = User.query.get(user_id)
                if user and user in group.calendar.members and user.id != group.calendar.owner_id:
                    group.members.append(user)
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'group': {
                    'id': group.id,
                    'name': group.name,
                    'color': group.color,
                    'position': group.position,
                    'members': [
                        {
                            'id': m.id,
                            'username': m.username,
                            'first_name': m.first_name,
                            'last_name': m.last_name,
                            'avatar': m.avatar
                        } for m in group.members
                    ]
                }
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/delete_group/<int:group_id>', methods=['DELETE'])
    @login_required
    def delete_group(group_id):
        group = Group.query.get_or_404(group_id)
        
        # Проверяем права доступа
        if group.owner_id != current_user.id and group.calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
        
        try:
            # Удаляем группу (участники остаются в календаре)
            db.session.delete(group)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Группа "{group.name}" удалена'
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/remove_member_from_group/<int:group_id>/<int:user_id>', methods=['POST'])
    @login_required
    def remove_member_from_group(group_id, user_id):
        group = Group.query.get_or_404(group_id)
        user = User.query.get_or_404(user_id)
        
        # Проверяем, что пользователь является владельцем группы ИЛИ владельцем календаря
        if group.owner_id != current_user.id and group.calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
        
        # Проверяем, что пользователь состоит в группе
        if user not in group.members:
            return jsonify({'success': False, 'error': 'Пользователь не состоит в этой группе'}), 400
        
        try:
            # Удаляем пользователя из группы
            group.members.remove(user)
            
            # Удаляем пользователя из календаря
            if user in group.calendar.members:
                group.calendar.members.remove(user)
                
                # Удаляем все смены пользователя в этом календаре
                Shift.query.filter_by(calendar_id=group.calendar.id, user_id=user.id).delete()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'{user.username} удален из группы и календаря',
                'removed_user': {
                    'id': user.id,
                    'username': user.username,
                    'avatar': user.avatar
                }
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/calendar/<int:calendar_id>/clear-all-shifts', methods=['POST'])
    @login_required
    def clear_all_shifts(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)
        
        # Проверка прав доступа - только владелец может очищать смены
        if calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещён'}), 403
        
        try:
            # Получаем месяц из запроса
            data = request.get_json() or {}
            month = data.get('month')
            
            if month:
                try:
                    # Парсим месяц и определяем диапазон дат
                    current_month = datetime.strptime(month, '%Y-%m-%d').date().replace(day=1)
                    next_month = current_month.replace(day=28) + timedelta(days=4)
                    last_day = next_month - timedelta(days=next_month.day)
                    
                    # Удаляем смены только за указанный месяц
                    deleted_count = Shift.query.filter(
                        Shift.calendar_id == calendar.id,
                        Shift.date >= current_month,
                        Shift.date <= last_day
                    ).delete()
                except ValueError:
                    # Если месяц некорректный, удаляем все смены
                    deleted_count = Shift.query.filter_by(calendar_id=calendar.id).delete()
            else:
                # Если месяц не указан, удаляем все смены календаря
                deleted_count = Shift.query.filter_by(calendar_id=calendar.id).delete()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'Удалено смен: {deleted_count}',
                'deleted_count': deleted_count
            })
            
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error clearing shifts: {str(e)}")
            return jsonify({'success': False, 'error': 'Ошибка при удалении смен'}), 500

    @app.route('/upload_avatar', methods=['POST'])
    @login_required
    def upload_avatar():
        try:
            if 'avatar' not in request.files:
                return jsonify({'success': False, 'message': 'Файл не выбран'}), 400

            file = request.files['avatar']
            if file.filename == '':
                return jsonify({'success': False, 'message': 'Файл не выбран'}), 400

            if file and allowed_file(file.filename):
                # Создаем безопасное имя файла с уникальным идентификатором
                filename = secure_filename(file.filename)
                file_extension = filename.rsplit('.', 1)[1].lower()
                unique_filename = f"avatar_{current_user.id}_{int(datetime.now().timestamp())}.{file_extension}"
                
                # Путь для сохранения файла
                upload_path = os.path.join(app.config['UPLOAD_FOLDER'], 'images', unique_filename)
                
                # Создаем директорию если её нет
                os.makedirs(os.path.dirname(upload_path), exist_ok=True)
                
                # Удаляем старый аватар если он не дефолтный
                if current_user.avatar and current_user.avatar != 'default_avatar.svg':
                    old_avatar_path = os.path.join(app.config['UPLOAD_FOLDER'], 'images', current_user.avatar)
                    if os.path.exists(old_avatar_path):
                        try:
                            os.remove(old_avatar_path)
                        except OSError:
                            pass  # Игнорируем ошибки удаления старого файла
                
                # Сохраняем новый файл
                file.save(upload_path)
                
                # Обновляем аватар пользователя в базе данных
                current_user.avatar = unique_filename
                db.session.commit()
                
                # Возвращаем успешный ответ с URL нового аватара
                avatar_url = url_for('static', filename=f'images/{unique_filename}')
                return jsonify({
                    'success': True,
                    'message': 'Аватар успешно обновлен',
                    'avatar_url': avatar_url
                })
            else:
                return jsonify({'success': False, 'message': 'Неподдерживаемый формат файла'}), 400

        except Exception as e:
            app.logger.error(f"Error uploading avatar: {str(e)}")
            return jsonify({'success': False, 'message': 'Ошибка при загрузке аватара'}), 500

    # Profile routes
    @app.route('/profile')
    @login_required
    def profile():
        # Подсчет статистики пользователя
        user_shifts = Shift.query.filter_by(user_id=current_user.id).all()
        
        # Подсчет общего времени работы
        total_hours = 0
        shifts_with_time = 0
        
        for shift in user_shifts:
            if shift.start_time and shift.end_time and shift.show_time:
                shifts_with_time += 1
                # Вычисляем разность времени
                start_datetime = datetime.combine(shift.date, shift.start_time)
                end_datetime = datetime.combine(shift.date, shift.end_time)
                
                # Если смена переходит на следующий день
                if shift.end_time < shift.start_time:
                    end_datetime += timedelta(days=1)
                
                duration = end_datetime - start_datetime
                total_hours += duration.total_seconds() / 3600
        
        total_calendars = Calendar.query.filter_by(owner_id=current_user.id).count()
        total_friends = current_user.friends.count()
        
        return render_template('profile/profile.html', 
                             total_shifts=shifts_with_time,
                             total_calendars=total_calendars, 
                             total_friends=total_friends,
                             total_hours=round(total_hours, 1))

    @app.route('/profile/<username>')
    @login_required
    def view_user_profile(username):
        # Находим пользователя по username
        user = User.query.filter_by(username=username).first_or_404()
        
        # Подсчет статистики пользователя
        user_shifts = Shift.query.filter_by(user_id=user.id).all()
        
        # Подсчет общего времени работы
        total_hours = 0
        shifts_with_time = 0
        
        for shift in user_shifts:
            if shift.start_time and shift.end_time and shift.show_time:
                shifts_with_time += 1
                # Вычисляем разность времени
                start_datetime = datetime.combine(shift.date, shift.start_time)
                end_datetime = datetime.combine(shift.date, shift.end_time)
                
                # Если смена переходит на следующий день
                if shift.end_time < shift.start_time:
                    end_datetime += timedelta(days=1)
                
                duration = end_datetime - start_datetime
                total_hours += duration.total_seconds() / 3600
        
        total_calendars = Calendar.query.filter_by(owner_id=user.id).count()
        total_friends = user.friends.count()
        
        # Проверяем, является ли пользователь другом текущего пользователя
        is_friend = user in current_user.friends.all()
        
        return render_template('profile/user_profile.html', 
                             user=user,
                             total_shifts=shifts_with_time,
                             total_calendars=total_calendars, 
                             total_friends=total_friends,
                             total_hours=round(total_hours, 1),
                             is_friend=is_friend)

    @app.route('/profile/update', methods=['POST'])
    @login_required
    def update_profile():
        try:
            data = request.get_json()
            
            # Обновление персональных данных
            if 'first_name' in data:
                current_user.first_name = data['first_name'].strip()
            if 'last_name' in data:
                current_user.last_name = data['last_name'].strip()
            if 'username' in data:
                username = data['username'].strip()
                # Проверка уникальности username
                if username != current_user.username:
                    existing_user = User.query.filter_by(username=username).first()
                    if existing_user:
                        return jsonify({'success': False, 'message': 'Имя пользователя уже занято'}), 400
                    current_user.username = username
            if 'email' in data:
                email = data['email'].strip()
                # Проверка уникальности email
                if email != current_user.email:
                    existing_user = User.query.filter_by(email=email).first()
                    if existing_user:
                        return jsonify({'success': False, 'message': 'Email уже используется'}), 400
                    current_user.email = email
            if 'age' in data:
                age = data.get('age')
                current_user.age = int(age) if age and str(age).isdigit() else None
            if 'phone' in data:
                current_user.phone = data['phone'].strip() if data['phone'] else None
            
            db.session.commit()
            return jsonify({'success': True, 'message': 'Профиль обновлен'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Ошибка обновления: {str(e)}'}), 500

    @app.route('/profile/change-password', methods=['POST'])
    @login_required
    def change_password():
        try:
            data = request.get_json()
            current_password = data.get('current_password')
            new_password = data.get('new_password')
            
            if not current_password or not new_password:
                return jsonify({'success': False, 'message': 'Заполните все поля'}), 400
            
            # Проверка текущего пароля
            if not check_password_hash(current_user.password_hash, current_password):
                return jsonify({'success': False, 'message': 'Неверный текущий пароль'}), 400
            
            # Обновление пароля
            current_user.password_hash = generate_password_hash(new_password)
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Пароль успешно изменен'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Ошибка смены пароля: {str(e)}'}), 500

    @app.route('/profile/delete-avatar', methods=['POST'])
    @login_required
    def delete_avatar():
        try:
            # Удаляем старый аватар, если он не дефолтный
            if current_user.avatar and current_user.avatar != 'default_avatar.svg':
                old_avatar_path = os.path.join(app.config['UPLOAD_FOLDER'], current_user.avatar)
                if os.path.exists(old_avatar_path):
                    os.remove(old_avatar_path)
            
            # Устанавливаем дефолтный аватар
            current_user.avatar = 'default_avatar.svg'
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Аватар удален', 'avatar_url': url_for('static', filename='images/default_avatar.svg')})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': f'Ошибка удаления аватара: {str(e)}'}), 500

    # Settings routes
    @app.route('/settings')
    @login_required
    def settings():
        """Страница настроек пользователя"""
        return render_template('settings/settings.html')

    #############УДАЛИТЬ ПОСЛЕ ТЕСТА САЙТА############
    @app.route('/add_test_users')
    @login_required
    def add_test_users():
        try:
            current_user_id = current_user.id
            test_users = [
                {"username": "leonardo_dicaprio", "email": "1@mail.ru", "password": "123123", "first_name": "Леонардо", "last_name": "ДиКаприо", "avatar": "leonardo.png"},
                {"username": "brad_pitt", "email": "2@mail.ru", "password": "123123", "first_name": "Брэд", "last_name": "Питт", "avatar": "brad.png"},
                {"username": "angelina_jolie", "email": "3@mail.ru", "password": "123123", "first_name": "Анджелина", "last_name": "Джоли", "avatar": "angelina.png"},
                {"username": "robert_downey", "email": "4@mail.ru", "password": "123123", "first_name": "Роберт", "last_name": "Дауни", "avatar": "robert.png"},
                {"username": "scarlett_johansson", "email": "5@mail.ru", "password": "123123", "first_name": "Скарлетт", "last_name": "Йоханссон", "avatar": "scarlett.png"},
                {"username": "tom_cruise", "email": "6@mail.ru", "password": "123123", "first_name": "Том", "last_name": "Круз", "avatar": "tom.png"},
                {"username": "jennifer_lawrence", "email": "7@mail.ru", "password": "123123", "first_name": "Дженнифер", "last_name": "Лоуренс", "avatar": "jennifer.png"},
                {"username": "will_smith", "email": "8@mail.ru", "password": "123123", "first_name": "Уилл", "last_name": "Смит", "avatar": "will.png"},
                {"username": "emma_stone", "email": "9@mail.ru", "password": "123123", "first_name": "Эмма", "last_name": "Стоун", "avatar": "emma.png"},
                {"username": "ryan_gosling", "email": "10@mail.ru", "password": "123123", "first_name": "Райан", "last_name": "Гослинг", "avatar": "ryan.png"},
                {"username": "margot_robbie", "email": "11@mail.ru", "password": "123123", "first_name": "Марго", "last_name": "Робби", "avatar": "margot.png"},
                {"username": "chris_hemsworth", "email": "12@mail.ru", "password": "123123", "first_name": "Крис", "last_name": "Хемсворт", "avatar": "chris.png"},
                {"username": "natalie_portman", "email": "13@mail.ru", "password": "123123", "first_name": "Натали", "last_name": "Портман", "avatar": "natalie.png"},
                {"username": "johnny_depp", "email": "14@mail.ru", "password": "123123", "first_name": "Джонни", "last_name": "Депп", "avatar": "johnny.png"},
                {"username": "anne_hathaway", "email": "15@mail.ru", "password": "123123", "first_name": "Энн", "last_name": "Хэтэуэй", "avatar": "anne.png"},
                {"username": "matthew_mcconaughey", "email": "16@mail.ru", "password": "123123", "first_name": "Мэттью", "last_name": "МакКонахи", "avatar": "matthew.png"},
                {"username": "charlize_theron", "email": "17@mail.ru", "password": "123123", "first_name": "Шарлиз", "last_name": "Терон", "avatar": "charlize.png"},
                {"username": "christian_bale", "email": "18@mail.ru", "password": "123123", "first_name": "Кристиан", "last_name": "Бэйл", "avatar": "christian.png"},
                {"username": "amy_adams", "email": "19@mail.ru", "password": "123123", "first_name": "Эми", "last_name": "Адамс", "avatar": "amy.png"},
                {"username": "hugh_jackman", "email": "20@mail.ru", "password": "123123", "first_name": "Хью", "last_name": "Джекман", "avatar": "hugh.png"}
            ]

            added_users = []

            for user_data in test_users:
                # Проверяем, существует ли пользователь
                existing_user = User.query.filter(
                    (User.username == user_data["username"]) |
                    (User.email == user_data["email"])
                ).first()

                if not existing_user:
                    # Создаем нового пользователя
                    user_id = generate_user_id()
                    while User.query.get(user_id):
                        user_id = generate_user_id()

                    hashed_password = generate_password_hash(user_data["password"])
                    
                    # Проверяем наличие файла аватара
                    avatar_filename = user_data.get("avatar")
                    avatar_path = None
                    if avatar_filename:
                        avatar_path = os.path.join(app.config.get('UPLOAD_FOLDER', 'static'), 'images', avatar_filename)
                        if not os.path.exists(avatar_path):
                            avatar_filename = None  # Если файл не существует, используем дефолтный аватар
                    
                    new_user = User(
                        id=user_id,
                        username=user_data["username"],
                        email=user_data["email"],
                        password_hash=hashed_password,
                        first_name=user_data["first_name"],
                        last_name=user_data["last_name"],
                        avatar=avatar_filename
                    )
                    db.session.add(new_user)
                    added_users.append(new_user)

            # Сохраняем всех пользователей
            db.session.commit()

            # Добавляем друзей для текущего пользователя
            current_user_obj = User.query.get(current_user_id)
            for user in added_users:
                if user not in current_user_obj.friends:
                    current_user_obj.friends.append(user)
                    user.friends.append(current_user_obj)

            db.session.commit()

            flash(f"Добавлено {len(added_users)} тестовых пользователей и установлены дружеские связи", "success")
            return redirect(url_for('friends_page'))

        except Exception as e:
            db.session.rollback()
            flash(f"Ошибка: {str(e)}", "danger")
            return redirect(url_for('friends_page'))

def apply_filters(query, filters):
    """Apply filters to shift query"""
    if not filters:
        return query
    
    # Filter by users
    if filters.get('users'):
        query = query.filter(Shift.user_id.in_(filters['users']))
    
    # Filter by shift type (based on color_class)
    if filters.get('shiftType'):
        shift_types = filters['shiftType']
        if isinstance(shift_types, str):
            shift_types = [shift_types]
        
        if shift_types and shift_types != ['']:
            # Filter by color_class from shift templates
            query = query.join(ShiftTemplate).filter(ShiftTemplate.color_class.in_(shift_types))
    
    # Filter by duration
    if filters.get('duration'):
        duration_type = filters['duration']
        if duration_type == 'short':
            # Short shifts: < 4 hours
            query = query.filter(
                (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) < 4 * 3600
            )
        elif duration_type == 'medium':
            # Medium shifts: 4-8 hours
            query = query.filter(
                (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) >= 4 * 3600,
                (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) <= 8 * 3600
            )
        elif duration_type == 'long':
            # Long shifts: > 8 hours
            query = query.filter(
                (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) > 8 * 3600
            )
    
    return query

    @app.route('/calendar/<int:calendar_id>/clear-all-shifts', methods=['POST'])
    @login_required
    def clear_all_shifts(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)
        
        # Проверка прав доступа - только владелец может очищать смены
        if calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещён'}), 403
        
        try:
            # Получаем месяц из запроса
            data = request.get_json() or {}
            month = data.get('month')
            
            if month:
                try:
                    # Парсим месяц и определяем диапазон дат
                    current_month = datetime.strptime(month, '%Y-%m-%d').date().replace(day=1)
                    next_month = current_month.replace(day=28) + timedelta(days=4)
                    last_day = next_month - timedelta(days=next_month.day)
                    
                    # Удаляем смены только за указанный месяц
                    deleted_count = Shift.query.filter(
                        Shift.calendar_id == calendar.id,
                        Shift.date >= current_month,
                        Shift.date <= last_day
                    ).delete()
                except ValueError:
                    # Если месяц некорректный, удаляем все смены
                    deleted_count = Shift.query.filter_by(calendar_id=calendar.id).delete()
            else:
                # Если месяц не указан, удаляем все смены календаря
                deleted_count = Shift.query.filter_by(calendar_id=calendar.id).delete()
                
            db.session.commit()
            
            return jsonify({
                'success': True, 
                'message': f'Удалено смен: {deleted_count}',
                'deleted_count': deleted_count
            })
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error clearing shifts: {str(e)}")
            return jsonify({'success': False, 'error': 'Ошибка при удалении смен'}), 500

    @app.route('/calendar/<int:calendar_id>/members', methods=['GET'])
    @login_required
    def get_calendar_members(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        # Проверка доступа
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            abort(403)

        # Возвращаем участников с их позицией из calendar_members, отсортированных по позиции (возрастание)
        # Владелец не включается (для групп он не нужен)
        rows = (
            db.session.query(User.id, User.username, User.first_name, User.last_name, User.avatar, calendar_members.c.position)
            .join(calendar_members, (calendar_members.c.user_id == User.id) & (calendar_members.c.calendar_id == calendar.id))
            .order_by(calendar_members.c.position.asc(), User.id.asc())
            .all()
        )

        members = [
            {
                'id': r.id,
                'username': r.username,
                'first_name': r.first_name,
                'last_name': r.last_name,
                'avatar': r.avatar,
                'position': int(r.position) if r.position is not None else None,
            }
            for r in rows
        ]

        return jsonify(members)

    @app.route('/calendar/<int:calendar_id>/shifts', methods=['GET'])
    @login_required
    def get_calendar_shifts(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        # Проверка доступа
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            abort(403)

        # Получаем месяц из параметров запроса
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

        shifts = Shift.query.filter(
            Shift.calendar_id == calendar_id,
            Shift.date >= current_month,
            Shift.date <= last_day
        ).all()

        # Формируем список смен
        shifts_data = []
        for shift in shifts:
            shift_data = {
                'id': shift.id,
                'user_id': shift.user_id,
                'date': shift.date.strftime('%Y-%m-%d'),
                'title': shift.title,
                'color_class': shift.color_class,
                'show_time': shift.show_time
            }
            
            if shift.show_time and shift.start_time and shift.end_time:
                shift_data['start_time'] = shift.start_time.strftime('%H:%M')
                shift_data['end_time'] = shift.end_time.strftime('%H:%M')
            
            shifts_data.append(shift_data)

        return jsonify(shifts_data)


    @app.route('/calendar/<int:calendar_id>/update-positions', methods=['POST'])
    @login_required
    def update_calendar_positions(calendar_id):
        if not request.is_json:
            return jsonify({'success': False, 'error': 'Invalid content type'}), 400

        calendar = Calendar.query.get_or_404(calendar_id)

        if calendar.owner_id != current_user.id:
                return jsonify({
                    'success': False,
                    'error': 'Forbidden',
                    'message': 'Только владелец календаря может изменять порядок участников'
                }), 403

        try:
            data = request.get_json() or {}
            # Поддерживаем оба формата: { "positions": {"<uid>": pos} } и {"<uid>": pos}
            positions = data.get('positions') if isinstance(data, dict) and 'positions' in data else data

            if not isinstance(positions, dict) or not positions:
                return jsonify({'success': False, 'error': 'Empty positions data'}), 400

            # Приводим ключи и значения к int и валидируем
            try:
                normalized = {int(uid): int(pos) for uid, pos in positions.items()}
            except Exception:
                return jsonify({'success': False, 'error': 'Positions must be a dict of {user_id:int -> position:int}'}), 400

            valid_user_ids = {m.id for m in calendar.members}
            for uid in normalized.keys():
                if uid not in valid_user_ids:
                    return jsonify({'success': False, 'error': f'Invalid user ID: {uid}'}), 400

            # Обновляем позиции по одной записи
            for uid, pos in normalized.items():
                db.session.execute(
                    calendar_members.update()
                    .where(calendar_members.c.calendar_id == calendar.id)
                    .where(calendar_members.c.user_id == uid)
                    .values(position=pos)
                )

            db.session.commit()

            return jsonify({
                'success': True,
                'message': 'Positions updated successfully',
                'updated_count': len(normalized)
            })

        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Position update error: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/get_template_info/<int:template_id>', methods=['GET'])
    @login_required
    def get_template_info(template_id):
        template = ShiftTemplate.query.get_or_404(template_id)

        # Проверка прав доступа
        if template.owner_id != current_user.id and current_user not in template.calendar.members:
            abort(403)

        return jsonify({
            'id': template.id,
            'title': template.title,
            'start_time': template.start_time.strftime('%H:%M'),
            'end_time': template.end_time.strftime('%H:%M'),
            'show_time': template.show_time
        })

    @app.route('/api/get_shift_info/<int:shift_id>', methods=['GET'])
    @login_required
    def get_shift_info(shift_id):
        shift = Shift.query.get_or_404(shift_id)

        # Проверка прав доступа
        if shift.calendar.owner_id != current_user.id and current_user not in shift.calendar.members:
            abort(403)

        show_time = True
        if shift.template:
            show_time = shift.template.show_time

        return jsonify({
            'id': shift.id,
            'title': shift.title,
            'start_time': shift.start_time.strftime('%H:%M'),
            'end_time': shift.end_time.strftime('%H:%M'),
            'show_time': shift.show_time,
            'template': {
                'id': shift.template.id if shift.template else None,
                'color_class': shift.template.color_class if shift.template else 'badge-color-1'
            }
        })

    # Маршруты для работы с группами
    @app.route('/api/create_group', methods=['POST'])
    @login_required
    def create_group():
        data = request.get_json()
        calendar_id = data.get('calendar_id')
        name = data.get('name')
        color = data.get('color', 'badge-color-1')
        user_ids = data.get('user_ids', [])

        calendar = Calendar.query.get_or_404(calendar_id)
        if calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

        try:
            # Получаем максимальную позицию для групп в этом календаре
            max_position = db.session.query(db.func.max(Group.position)).filter(
                Group.calendar_id == calendar_id
            ).scalar() or 0
            
            # Новая группа получает позицию на 1 больше максимальной
            new_position = max_position + 1
            
            group = Group(
                name=name,
                color=color,
                calendar_id=calendar_id,
                owner_id=current_user.id,
                position=new_position
            )
            db.session.add(group)
            db.session.flush()  # Получаем ID группы

            # Добавляем участников в группу (исключаем создателя календаря)
            for user_id in user_ids:
                user = User.query.get(user_id)
                if user and user in calendar.members and user.id != calendar.owner_id:
                    group.members.append(user)

            db.session.commit()

            return jsonify({
                'success': True,
                'group': {
                    'id': group.id,
                    'name': group.name,
                    'color': group.color,
                    'position': group.position,
                    'members': [{'id': m.id, 'username': m.username, 'avatar': m.avatar} for m in group.members]
                }
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/update_group/<int:group_id>', methods=['PUT'])
    @login_required
    def update_group(group_id):
        group = Group.query.get_or_404(group_id)
        # Проверяем, что пользователь является владельцем группы ИЛИ владельцем календаря
        if group.owner_id != current_user.id and group.calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

        data = request.get_json()
        name = data.get('name')
        color = data.get('color')
        user_ids = data.get('user_ids', [])

        try:
            if name:
                group.name = name
            if color:
                group.color = color

            # Обновляем участников группы (исключаем создателя календаря)
            group.members.clear()
            for user_id in user_ids:
                user = User.query.get(user_id)
                if user and user in group.calendar.members and user.id != group.calendar.owner_id:
                    group.members.append(user)

            db.session.commit()

            return jsonify({
                'success': True,
                'group': {
                    'id': group.id,
                    'name': group.name,
                    'color': group.color,
                    'position': group.position,
                    'members': [{'id': m.id, 'username': m.username, 'avatar': m.avatar} for m in group.members]
                }
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/delete_group/<int:group_id>', methods=['DELETE'])
    @login_required
    def delete_group(group_id):
        group = Group.query.get_or_404(group_id)
        # Проверяем, что пользователь является владельцем группы ИЛИ владельцем календаря
        if group.owner_id != current_user.id and group.calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

        try:
            db.session.delete(group)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Группа успешно удалена'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/get_calendar_groups/<int:calendar_id>', methods=['GET'])
    @login_required
    def get_calendar_groups(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

        # Возвращаем группы в порядке позиции (новые выше), при равной позиции — по id (новые выше)
        groups = (
            Group.query
            .filter_by(calendar_id=calendar_id)
            .order_by(Group.position.desc(), Group.id.desc())
            .all()
        )
        groups_data = []
        
        for group in groups:
            groups_data.append({
                'id': group.id,
                'name': group.name,
                'color': group.color,
                'owner_id': group.owner_id,
                'position': group.position,
                'members': [
                    {
                        'id': m.id,
                        'username': m.username,
                        'first_name': m.first_name,
                        'last_name': m.last_name,
                        'avatar': m.avatar
                    } for m in group.members
                ]
            })

        return jsonify({'success': True, 'groups': groups_data})

    @app.route('/api/get_user_groups/<int:calendar_id>', methods=['GET'])
    @login_required
    def get_user_groups(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)
        if calendar.owner_id != current_user.id and current_user not in calendar.members:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403

        # Получаем всех участников календаря с их группами
        all_members = [calendar.owner] + list(calendar.members)
        members_with_groups = []

        for member in all_members:
            member_groups = Group.query.filter(
                Group.members.contains(member)
            ).filter_by(calendar_id=calendar_id).all()
            
            members_with_groups.append({
                'id': member.id,
                'username': member.username,
                'first_name': member.first_name,
                'last_name': member.last_name,
                'avatar': member.avatar,
                'groups': [{'id': g.id, 'name': g.name, 'color': g.color} for g in member_groups]
            })

        return jsonify({'success': True, 'members': members_with_groups})

    @app.route('/api/update_group_positions/<int:calendar_id>', methods=['POST'])
    @login_required
    def update_group_positions(calendar_id):
        """Обновляет порядок групп в календаре.
        Ожидает JSON вида { "order": [group_id_top, group_id_next, ...] }
        Позиции присваиваются так, чтобы первый элемент имел наибольшую позицию (для order_by desc).
        """
        calendar = Calendar.query.get_or_404(calendar_id)
        if calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Изменять порядок групп может только владелец календаря'}), 403

        data = request.get_json(silent=True) or {}
        order = data.get('order')
        if not isinstance(order, list) or not all(isinstance(i, int) for i in order):
            return jsonify({'success': False, 'error': 'Некорректный формат данных'}), 400

        # Получаем все группы календаря
        groups = Group.query.filter_by(calendar_id=calendar_id).all()
        group_map = {g.id: g for g in groups}

        # Фильтруем входной порядок только по существующим группам этого календаря
        filtered_order = [gid for gid in order if gid in group_map]
        if not filtered_order:
            return jsonify({'success': False, 'error': 'Список групп пуст или неверен'}), 400

        try:
            # Максимальная позиция присваивается верхнему элементу
            max_pos = len(filtered_order)
            for idx, gid in enumerate(filtered_order):
                group_map[gid].position = max_pos - idx

            db.session.commit()
            return jsonify({'success': True})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/remove_member_from_group/<int:group_id>/<int:user_id>', methods=['POST'])
    @login_required
    def remove_member_from_group(group_id, user_id):
        group = Group.query.get_or_404(group_id)
        user = User.query.get_or_404(user_id)
        
        # Проверяем, что пользователь является владельцем группы ИЛИ владельцем календаря
        if group.owner_id != current_user.id and group.calendar.owner_id != current_user.id:
            return jsonify({'success': False, 'error': 'Доступ запрещен'}), 403
        
        # Проверяем, что пользователь состоит в группе
        if user not in group.members:
            return jsonify({'success': False, 'error': 'Пользователь не состоит в этой группе'}), 400
        
        try:
            # Удаляем пользователя из группы
            group.members.remove(user)
            
            # Удаляем пользователя из календаря
            if user in group.calendar.members:
                group.calendar.members.remove(user)
                
                # Удаляем все смены пользователя в этом календаре
                Shift.query.filter_by(calendar_id=group.calendar.id, user_id=user.id).delete()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': f'{user.username} удален из группы и календаря',
                'removed_user': {
                    'id': user.id,
                    'username': user.username,
                    'avatar': user.avatar
                }
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/upload_avatar', methods=['POST'])
    @login_required
    def upload_avatar():
        try:
            if 'avatar' not in request.files:
                return jsonify({'success': False, 'message': 'Файл не выбран'}), 400

            file = request.files['avatar']
            if file.filename == '':
                return jsonify({'success': False, 'message': 'Файл не выбран'}), 400

            if file and allowed_file(file.filename):
                # Создаем безопасное имя файла с уникальным идентификатором
                filename = secure_filename(file.filename)
                file_extension = filename.rsplit('.', 1)[1].lower()
                unique_filename = f"avatar_{current_user.id}_{int(datetime.now().timestamp())}.{file_extension}"
                
                # Путь для сохранения файла
                upload_path = os.path.join(app.config['UPLOAD_FOLDER'], 'images', unique_filename)
                
                # Создаем директорию если её нет
                os.makedirs(os.path.dirname(upload_path), exist_ok=True)
                
                # Удаляем старый аватар если он не дефолтный
                if current_user.avatar and current_user.avatar != 'default_avatar.svg':
                    old_avatar_path = os.path.join(app.config['UPLOAD_FOLDER'], 'images', current_user.avatar)
                    if os.path.exists(old_avatar_path):
                        try:
                            os.remove(old_avatar_path)
                        except OSError:
                            pass  # Игнорируем ошибки удаления старого файла
                
                # Сохраняем новый файл
                file.save(upload_path)
                
                # Обновляем аватар пользователя в базе данных
                current_user.avatar = unique_filename
                db.session.commit()
                
                # Возвращаем успешный ответ с URL нового аватара
                avatar_url = url_for('static', filename=f'images/{unique_filename}')
                return jsonify({
                    'success': True,
                    'message': 'Аватар успешно обновлен',
                    'avatar_url': avatar_url
                })
            else:
                return jsonify({'success': False, 'message': 'Неподдерживаемый формат файла'}), 400

        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error uploading avatar: {str(e)}")
            return jsonify({'success': False, 'message': 'Ошибка при загрузке аватара'}), 500


# Analysis helper functions
def get_week_range(month_str):
    """Get start and end date for a week period"""
    try:
        if 'W' in month_str:
            # Parse week format: 2025-W35
            year, week = month_str.split('-W')
            # Use ISO week date parsing
            date = datetime.strptime(f'{year}-W{week.zfill(2)}-1', '%Y-W%W-%w').date()
            start_date = date - timedelta(days=date.weekday())
            end_date = start_date + timedelta(days=6)
            return start_date, end_date
        else:
            # Old format fallback
            date = datetime.strptime(month_str, '%Y-%m').date()
            # Get the first day of the week containing the first day of the month
            start_date = date - timedelta(days=date.weekday())
            end_date = start_date + timedelta(days=6)
            return start_date, end_date
    except ValueError:
        # Fallback to current week
        today = datetime.utcnow().date()
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=6)
        return start_date, end_date


def get_month_range(month_str):
    """Get start and end date for a month period"""
    try:
        date = datetime.strptime(month_str, '%Y-%m').date().replace(day=1)
        next_month = date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
        return date, end_date
    except ValueError:
        # Fallback to current month
        today = datetime.utcnow().date()
        start_date = today.replace(day=1)
        next_month = start_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
        return start_date, end_date


def get_quarter_range(month_str):
    """Get start and end date for a quarter period"""
    try:
        if 'Q' in month_str:
            # Parse quarter format: 2025-Q3
            year, quarter = month_str.split('-Q')
            year = int(year)
            quarter = int(quarter)
            start_month = (quarter - 1) * 3 + 1
            start_date = datetime(year, start_month, 1).date()
            
            if quarter == 4:
                end_date = datetime(year, 12, 31).date()
            else:
                end_month = quarter * 3
                import calendar
                last_day = calendar.monthrange(year, end_month)[1]
                end_date = datetime(year, end_month, last_day).date()
            
            return start_date, end_date
        else:
            # Old format fallback
            date = datetime.strptime(month_str, '%Y-%m').date()
            quarter = (date.month - 1) // 3 + 1
            start_month = (quarter - 1) * 3 + 1
            start_date = date.replace(month=start_month, day=1)
            
            if quarter == 4:
                end_date = date.replace(year=date.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                end_month = quarter * 3 + 1
                end_date = date.replace(month=end_month, day=1) - timedelta(days=1)
            
            return start_date, end_date
    except ValueError:
        # Fallback to current quarter
        today = datetime.utcnow().date()
        quarter = (today.month - 1) // 3 + 1
        start_month = (quarter - 1) * 3 + 1
        start_date = today.replace(month=start_month, day=1)
        
        if quarter == 4:
            end_date = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end_month = quarter * 3 + 1
            end_date = today.replace(month=end_month, day=1) - timedelta(days=1)
        
        return start_date, end_date


def get_year_range(month_str):
    """Get start and end date for a year period"""
    try:
        # For year period, month_str is just the year (e.g., '2024')
        if len(month_str) == 4 and month_str.isdigit():
            year = int(month_str)
        else:
            # Try parsing as year-month format and extract year
            date = datetime.strptime(month_str, '%Y-%m').date()
            year = date.year
        
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()
        return start_date, end_date
    except (ValueError, TypeError):
        # Fallback to current year
        today = datetime.utcnow().date()
        start_date = today.replace(month=1, day=1)
        end_date = today.replace(month=12, day=31)
        return start_date, end_date


def calculate_shift_stats(calendar_ids, start_date, end_date, filters=None, user_id=None, user_calendar_roles=None):
    """Calculate shift statistics"""
    query = Shift.query.filter(
        Shift.calendar_id.in_(calendar_ids),
        Shift.date >= start_date,
        Shift.date <= end_date
    )
    
    # If user is only a participant (not creator of any selected calendars), show only their shifts
    if user_id and user_calendar_roles:
        is_creator_of_any = any(role == 'creator' for role in user_calendar_roles.values())
        if not is_creator_of_any:
            query = query.filter(Shift.user_id == user_id)
    
    if filters:
        query = apply_filters(query, filters)
    
    shifts = query.all()
    
    if not shifts:
        return {
            'total_hours': 0,
            'total_shifts': 0,
            'avg_duration': 0,
            'top_template': None
        }
    
    total_minutes = 0
    template_usage = {}
    
    for shift in shifts:
        # Only calculate duration for shifts that show time
        if shift.show_time:
            # Calculate shift duration in minutes
            start_time = datetime.combine(shift.date, shift.start_time)
            end_time = datetime.combine(shift.date, shift.end_time)
            
            # Handle shifts that cross midnight
            if end_time < start_time:
                end_time += timedelta(days=1)
            
            duration = (end_time - start_time).total_seconds() / 60
            total_minutes += duration
        
        # Track template usage only for shifts with time
        if shift.show_time and shift.template_id:
            template = ShiftTemplate.query.get(shift.template_id)
            if template:
                template_usage[template.title] = template_usage.get(template.title, 0) + 1
    
    total_hours = total_minutes / 60
    # Only calculate average duration for shifts with time
    shifts_with_time = [shift for shift in shifts if shift.show_time]
    avg_duration = total_minutes / len(shifts_with_time) if shifts_with_time else 0
    top_template = max(template_usage.items(), key=lambda x: x[1])[0] if template_usage else None
    
    return {
        'total_hours': round(total_hours, 1),
        'total_shifts': len(shifts_with_time),
        'avg_duration': round(avg_duration),
        'top_template': top_template
    }


def calculate_team_analysis(calendar_ids, start_date, end_date, filters=None, user_id=None, user_calendar_roles=None):
    """Calculate team analysis data"""
    # Get all users involved in shifts
    query = db.session.query(Shift, User).join(User, Shift.user_id == User.id).filter(
        Shift.calendar_id.in_(calendar_ids),
        Shift.date >= start_date,
        Shift.date <= end_date
    )
    
    # If user is only a participant (not creator of any selected calendars), show only their shifts
    if user_id and user_calendar_roles:
        is_creator_of_any = any(role == 'creator' for role in user_calendar_roles.values())
        if not is_creator_of_any:
            query = query.filter(Shift.user_id == user_id)
    
    if filters:
        # Apply filters to the Shift part of the query
        if filters.get('users'):
            query = query.filter(Shift.user_id.in_(filters['users']))
        
        if filters.get('shiftType'):
            shift_types = filters['shiftType']
            if isinstance(shift_types, str):
                shift_types = [shift_types]
            
            if shift_types and shift_types != ['']:
                # Filter by color_class from shifts directly
                query = query.filter(Shift.color_class.in_(shift_types))
        
        if filters.get('duration'):
            duration_type = filters['duration']
            if duration_type == 'short':
                query = query.filter(
                    (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) < 4 * 3600
                )
            elif duration_type == 'medium':
                query = query.filter(
                    (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) >= 4 * 3600,
                    (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) <= 8 * 3600
                )
            elif duration_type == 'long':
                query = query.filter(
                    (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) > 8 * 3600
                )
    
    shifts = query.all()
    
    user_stats = {}
    coverage_data = []
    
    # Calculate user statistics
    for shift, user in shifts:
        if user.id not in user_stats:
            user_stats[user.id] = {
                'user': user,
                'total_hours': 0,
                'total_shifts': 0
            }
        
        # Only calculate duration and count shifts that show time
        if shift.show_time:
            # Calculate shift duration
            start_time = datetime.combine(shift.date, shift.start_time)
            end_time = datetime.combine(shift.date, shift.end_time)
            
            if end_time < start_time:
                end_time += timedelta(days=1)
            
            duration = (end_time - start_time).total_seconds() / 3600
            user_stats[user.id]['total_hours'] += duration
            user_stats[user.id]['total_shifts'] += 1
    
    # Create activity ranking
    activity_ranking = []
    for user_id, stats in user_stats.items():
        user = stats['user']
        activity_ranking.append({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'avatar': user.avatar,
            'total_hours': round(stats['total_hours'], 1),
            'total_shifts': stats['total_shifts']
        })
    
    # Sort by total hours descending
    activity_ranking.sort(key=lambda x: x['total_hours'], reverse=True)
    
    # Calculate coverage data (simplified - by day of month)
    # Русские названия месяцев
    russian_months = {
        1: 'Январь', 2: 'Февраль', 3: 'Март', 4: 'Апрель',
        5: 'Май', 6: 'Июнь', 7: 'Июль', 8: 'Август',
        9: 'Сентябрь', 10: 'Октябрь', 11: 'Ноябрь', 12: 'Декабрь'
    }
    
    current_date = start_date
    while current_date <= end_date:
        day_shifts = [s for s, u in shifts if s.date == current_date]
        coverage_percent = min(100, len(day_shifts) * 20)  # Simplified calculation
        
        coverage_data.append({
            'day': current_date.day,
            'month': current_date.month,
            'month_name': russian_months[current_date.month],
            'full_date': current_date.strftime('%Y-%m-%d'),
            'coverage_percent': coverage_percent,
            'shifts_count': len(day_shifts)
        })
        current_date += timedelta(days=1)
    
    # Workload balance data
    workload_balance = {
        'labels': [f"{u['first_name']} {u['last_name']}" for u in activity_ranking[:10]],
        'values': [u['total_hours'] for u in activity_ranking[:10]]
    }
    
    return {
        'activity_ranking': activity_ranking,
        'coverage_data': coverage_data,
        'workload_balance': workload_balance
    }


def calculate_time_slots(calendar_ids, start_date, end_date, filters=None, user_id=None, user_calendar_roles=None):
    """Calculate time slot distribution"""
    query = Shift.query.filter(
        Shift.calendar_id.in_(calendar_ids),
        Shift.date >= start_date,
        Shift.date <= end_date
    )
    
    # If user is only a participant (not creator of any selected calendars), show only their shifts
    if user_id and user_calendar_roles:
        is_creator_of_any = any(role == 'creator' for role in user_calendar_roles.values())
        if not is_creator_of_any:
            query = query.filter(Shift.user_id == user_id)
    
    if filters:
        query = apply_filters(query, filters)
    
    shifts = query.all()
    
    if not shifts:
        return {'templates': []}
    
    # Group shifts by their time ranges (template-like grouping)
    template_data = {}
    
    for shift in shifts:
        # Handle shifts with time
        if shift.show_time and shift.start_time and shift.end_time:
            time_range = f"{shift.start_time.strftime('%H:%M')} - {shift.end_time.strftime('%H:%M')}"
            template_key = f"{shift.title}|{time_range}"
        # Handle shifts without time
        else:
            time_range = "Без времени"
            template_key = f"{shift.title}|{time_range}"
        
        if template_key not in template_data:
            template_data[template_key] = {
                'title': shift.title,
                'time_range': time_range,
                'count': 0,
                'color_class': shift.color_class,
                'shifts': []
            }
        
        template_data[template_key]['count'] += 1
        template_data[template_key]['shifts'].append({
            'id': shift.id,
            'title': shift.title,
            'date': shift.date.strftime('%Y-%m-%d'),
            'user_id': shift.user_id
        })
    
    # Calculate total shifts for percentage (include all shifts for seasonal patterns)
    total_shifts = len(shifts)
    
    if total_shifts == 0:
        return {'templates': []}
    
    # Convert to list and calculate percentages
    templates_list = []
    for time_range, data in template_data.items():
        templates_list.append({
            'title': data['title'],
            'time_range': time_range,
            'percentage': (data['count'] / total_shifts) * 100,
            'count': data['count'],
            'color_class': data['color_class'],
            'shifts': data['shifts']
        })
    
    # Sort by usage count (most used first), then by title for same counts
    templates_list.sort(key=lambda x: (-x['count'], x['title']))
    
    return {'templates': templates_list}


def calculate_work_time_distribution(calendar_ids, start_date, end_date, filters=None, user_id=None, user_calendar_roles=None):
    """Calculate work time distribution by user"""
    query = db.session.query(Shift, User).join(User, Shift.user_id == User.id).filter(
        Shift.calendar_id.in_(calendar_ids),
        Shift.date >= start_date,
        Shift.date <= end_date
    )
    
    # If user is only a participant (not creator of any selected calendars), show only their shifts
    if user_id and user_calendar_roles:
        is_creator_of_any = any(role == 'creator' for role in user_calendar_roles.values())
        if not is_creator_of_any:
            query = query.filter(Shift.user_id == user_id)
    
    if filters:
        if filters.get('users'):
            query = query.filter(Shift.user_id.in_(filters['users']))
        
        if filters.get('shiftType'):
            shift_types = filters['shiftType']
            if isinstance(shift_types, str):
                shift_types = [shift_types]
            
            if shift_types and shift_types != ['']:
                # Filter by color_class from shifts directly
                query = query.filter(Shift.color_class.in_(shift_types))
        
        if filters.get('duration'):
            duration_type = filters['duration']
            if duration_type == 'short':
                query = query.filter(
                    (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) < 4 * 3600
                )
            elif duration_type == 'medium':
                query = query.filter(
                    (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) >= 4 * 3600,
                    (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) <= 8 * 3600
                )
            elif duration_type == 'long':
                query = query.filter(
                    (extract('epoch', Shift.end_time) - extract('epoch', Shift.start_time)) > 8 * 3600
                )
    
    shifts = query.all()
    
    user_hours = {}
    
    for shift, user in shifts:
        if user.id not in user_hours:
            user_hours[user.id] = {
                'name': f"{user.first_name} {user.last_name}",
                'hours': 0
            }
        
        # Only calculate duration for shifts that show time
        if shift.show_time:
            # Calculate shift duration
            start_time = datetime.combine(shift.date, shift.start_time)
            end_time = datetime.combine(shift.date, shift.end_time)
            
            if end_time < start_time:
                end_time += timedelta(days=1)
            
            duration = (end_time - start_time).total_seconds() / 3600
            user_hours[user.id]['hours'] += duration
    
    # Sort by hours and take top users
    sorted_users = sorted(user_hours.values(), key=lambda x: x['hours'], reverse=True)[:6]
    
    return {
        'labels': [user['name'] for user in sorted_users],
        'values': [round(user['hours'], 1) for user in sorted_users]
    }


def calculate_weekday_activity(calendar_ids, start_date, end_date, filters=None, user_id=None, user_calendar_roles=None):
    """Calculate activity by weekday"""
    query = Shift.query.filter(
        Shift.calendar_id.in_(calendar_ids),
        Shift.date >= start_date,
        Shift.date <= end_date
    )
    
    # If user is only a participant (not creator of any selected calendars), show only their shifts
    if user_id and user_calendar_roles:
        is_creator_of_any = any(role == 'creator' for role in user_calendar_roles.values())
        if not is_creator_of_any:
            query = query.filter(Shift.user_id == user_id)
    
    if filters:
        query = apply_filters(query, filters)
    
    shifts = query.all()
    
    weekday_hours = [0] * 7  # Monday = 0, Sunday = 6
    
    for shift in shifts:
        # Only calculate duration for shifts that show time
        if shift.show_time:
            weekday = shift.date.weekday()
            
            # Calculate shift duration
            start_time = datetime.combine(shift.date, shift.start_time)
            end_time = datetime.combine(shift.date, shift.end_time)
            
            if end_time < start_time:
                end_time += timedelta(days=1)
            
            duration = (end_time - start_time).total_seconds() / 3600
            weekday_hours[weekday] += duration
    
    return {
        'hours': [round(hours, 1) for hours in weekday_hours]
    }


def calculate_trends_data(calendar_ids, period, month, filters=None, user_id=None, user_calendar_roles=None):
    """Calculate trends data over time"""
    # Get date ranges for the last several periods
    periods = []
    trends_data = {
        'hours': {'labels': [], 'values': []},
        'shifts': {'labels': [], 'values': []},
        'people': {'labels': [], 'values': []}
    }
    
    try:
        if period == 'week' and 'W' in month:
            # Parse week format: 2024-W35
            year, week = month.split('-W')
            # Use ISO week date parsing
            base_date = datetime.strptime(f'{year}-W{week.zfill(2)}-1', '%Y-W%W-%w').date()
            print(f"Week parsing: {month} -> {base_date}")
        elif period == 'quarter' and 'Q' in month:
            # Parse quarter format: 2024-Q3
            year, quarter = month.split('-Q')
            quarter_month = (int(quarter) - 1) * 3 + 1
            base_date = datetime(int(year), quarter_month, 1).date()
            print(f"Quarter parsing: {month} -> {base_date} (Q{quarter} {year})")
        elif period == 'year' and len(month) == 4:
            # Parse year format: 2024
            base_date = datetime(int(month), 1, 1).date()
        else:
            # Parse month format: 2024-08
            base_date = datetime.strptime(month, '%Y-%m').date()
    except ValueError as e:
        print(f"Error parsing {month}: {e}")
        base_date = datetime.utcnow().date()
    
    for i in range(11, -1, -1):  # Last 12 periods
        if period == 'week':
            # Calculate each week going backwards from the selected week
            weeks_back = i  # i goes from 11 to 0, so 11 weeks back to current week
            target_date = base_date - timedelta(weeks=weeks_back)
            # Get start of week (Monday)
            start_date = target_date - timedelta(days=target_date.weekday())
            end_date = start_date + timedelta(days=6)
            label = f"Неделя {start_date.strftime('%d.%m')} - {end_date.strftime('%d.%m.%Y')}"
        elif period == 'month':
            # Calculate month by subtracting months properly
            year = base_date.year
            month_num = base_date.month - i
            
            # Handle year rollover
            while month_num <= 0:
                month_num += 12
                year -= 1
            
            period_date = datetime(year, month_num, 1).date()
            start_date, end_date = get_month_range(period_date.strftime('%Y-%m'))
            
            # Russian month names
            russian_months = {
                1: 'Янв', 2: 'Фев', 3: 'Мар', 4: 'Апр',
                5: 'Май', 6: 'Июн', 7: 'Июл', 8: 'Авг',
                9: 'Сен', 10: 'Окт', 11: 'Ноя', 12: 'Дек'
            }
            label = f"{russian_months[month_num]} {year}"
        elif period == 'quarter':
            # Calculate each quarter going backwards from the selected quarter
            base_quarter = (base_date.month - 1) // 3 + 1
            base_year = base_date.year
            
            quarters_back = i  # i goes from 11 to 0, so 11 quarters back to current quarter
            target_quarter = base_quarter - quarters_back
            target_year = base_year
            
            while target_quarter <= 0:
                target_quarter += 4
                target_year -= 1
            
            start_month = (target_quarter - 1) * 3 + 1
            start_date = datetime(target_year, start_month, 1).date()
            
            # Calculate end of quarter - last day of third month
            end_month = start_month + 2
            if end_month == 12:
                end_date = datetime(target_year, 12, 31).date()
            elif end_month in [3, 6, 9]:  # March, June, September
                if end_month == 3:  # March - check for leap year
                    if target_year % 4 == 0 and (target_year % 100 != 0 or target_year % 400 == 0):
                        end_date = datetime(target_year, 3, 31).date()
                    else:
                        end_date = datetime(target_year, 3, 31).date()
                elif end_month == 6:  # June
                    end_date = datetime(target_year, 6, 30).date()
                else:  # September
                    end_date = datetime(target_year, 9, 30).date()
            else:
                # For other months, use calendar to get last day
                import calendar
                last_day = calendar.monthrange(target_year, end_month)[1]
                end_date = datetime(target_year, end_month, last_day).date()
            
            label = f"Q{target_quarter} {target_year}"
        elif period == 'year':
            year = base_date.year - i
            start_date = datetime(year, 1, 1).date()
            end_date = datetime(year, 12, 31).date()
            label = str(year)
        
        # Get shifts for this period
        query = Shift.query.filter(
            Shift.calendar_id.in_(calendar_ids),
            Shift.date >= start_date,
            Shift.date <= end_date
        )
        
        # Debug logging
        print(f"Period {period}, i={i}, Label: {label}, Start: {start_date}, End: {end_date}")
        shift_count = query.count()
        print(f"Found {shift_count} shifts for period {label}")
        
        # If user is only a participant (not creator of any selected calendars), show only their shifts
        if user_id and user_calendar_roles:
            is_creator_of_any = any(role == 'creator' for role in user_calendar_roles.values())
            if not is_creator_of_any:
                query = query.filter(Shift.user_id == user_id)
        
        if filters:
            query = apply_filters(query, filters)
        
        shifts = query.all()
        
        # Calculate metrics
        total_hours = 0
        shifts_with_time = 0
        unique_users = set()
        
        for shift in shifts:
            # Only calculate duration for shifts that show time
            if shift.show_time:
                # Calculate duration
                start_time = datetime.combine(shift.date, shift.start_time)
                end_time = datetime.combine(shift.date, shift.end_time)
                
                if end_time < start_time:
                    end_time += timedelta(days=1)
                
                duration = (end_time - start_time).total_seconds() / 3600
                total_hours += duration
                shifts_with_time += 1
            
            unique_users.add(shift.user_id)
        
        trends_data['hours']['labels'].append(label)
        trends_data['hours']['values'].append(round(total_hours, 1))
        
        trends_data['shifts']['labels'].append(label)
        trends_data['shifts']['values'].append(shifts_with_time)
        
        trends_data['people']['labels'].append(label)
        trends_data['people']['values'].append(len(unique_users))
    
    return trends_data