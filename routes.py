import traceback
import logging
from flask import render_template, request, redirect, url_for, flash, jsonify, abort
from sqlalchemy import exists, and_
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from models import db, User, generate_user_id, generate_calendar_id, FriendRequest, Calendar, Shift, ShiftTemplate, calendar_members, Group, group_members

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
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/api/get_friends', methods=['GET'])
    @login_required
    def get_friends():
        friends = current_user.friends.all()
        results = [{
            'id': friend.id,
            'username': friend.username,
            'avatar': friend.avatar,
        } for friend in friends]
        return jsonify(results)


    @app.route('/calendar/<int:calendar_id>/clear-all-shifts', methods=['POST'])
    @login_required
    def clear_all_shifts(calendar_id):
        calendar = Calendar.query.get_or_404(calendar_id)

        # Проверка прав
        if calendar.owner_id != current_user.id:
            abort(403)

        try:
            # Удаляем все смены календаря
            Shift.query.filter_by(calendar_id=calendar.id).delete()
            db.session.commit()

            return jsonify({
                'success': True,
                'message': 'Все смены успешно удалены'
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'message': str(e)
            }), 500


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
            db.session.query(User.id, User.username, User.avatar, calendar_members.c.position)
            .join(calendar_members, (calendar_members.c.user_id == User.id) & (calendar_members.c.calendar_id == calendar.id))
            .order_by(calendar_members.c.position.asc(), User.id.asc())
            .all()
        )

        members = [
            {
                'id': r.id,
                'username': r.username,
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

        # Получаем смены для текущего месяца
        current_date = datetime.now()
        start_of_month = current_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_of_month = (start_of_month + timedelta(days=32)).replace(day=1) - timedelta(days=1)

        shifts = Shift.query.filter(
            Shift.calendar_id == calendar_id,
            Shift.date >= start_of_month.date(),
            Shift.date <= end_of_month.date()
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
                'members': [{'id': m.id, 'username': m.username, 'avatar': m.avatar} for m in group.members]
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

    #############УДАЛИТЬ ПОСЛЕ ТЕСТА САЙТА############
    @app.route('/add_test_users')
    @login_required
    def add_test_users():
        try:
            current_user_id = current_user.id
            test_users = [
                {"username": "test_user1", "email": "test1@example.com", "password": "password123"},
                {"username": "test_user2", "email": "test2@example.com", "password": "password123"},
                {"username": "test_user3", "email": "test3@example.com", "password": "password123"},
                {"username": "test_user4", "email": "test4@example.com", "password": "password123"},
                {"username": "test_user5", "email": "test5@example.com", "password": "password123"},
                {"username": "test_user6", "email": "test6@example.com", "password": "password123"},
                {"username": "test_user7", "email": "test7@example.com", "password": "password123"},
                {"username": "test_user8", "email": "test8@example.com", "password": "password123"},
                {"username": "test_user9", "email": "test9@example.com", "password": "password123"},
                {"username": "test_user10", "email": "test10@example.com", "password": "password123"},
                {"username": "test_user11", "email": "test11@example.com", "password": "password123"},
                {"username": "test_user12", "email": "test12@example.com", "password": "password123"},
                {"username": "test_user13", "email": "test13@example.com", "password": "password123"},
                {"username": "test_user14", "email": "test14@example.com", "password": "password123"},
                {"username": "test_user15", "email": "test15@example.com", "password": "password123"},
                {"username": "test_user16", "email": "test16@example.com", "password": "password123"},
                {"username": "test_user17", "email": "test17@example.com", "password": "password123"},
                {"username": "test_user18", "email": "test18@example.com", "password": "password123"},
                {"username": "test_user19", "email": "test19@example.com", "password": "password123"},
                {"username": "test_user20", "email": "test20@example.com", "password": "password123"}
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
                    new_user = User(
                        id=user_id,
                        username=user_data["username"],
                        email=user_data["email"],
                        password_hash=hashed_password
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