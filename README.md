# MyShiftly - Календарь Смен

Веб-приложение для управления рабочими сменами и командными календарями.

## Функции

- **Управление календарями** - создание личных и командных календарей
- **Система друзей** - добавление друзей и управление контактами
- **Шаблоны смен** - создание и использование шаблонов для быстрого планирования
- **Профили пользователей** - регистрация, авторизация, аватары
- **Цветовое кодирование** - различные цвета для типов смен
- **Временные зоны** - поддержка московского времени
- **Адаптивный дизайн** - работает на всех устройствах

## Технологии

- **Backend**: Flask, SQLAlchemy, Flask-Login
- **Frontend**: HTML, CSS, JavaScript
- **База данных**: SQLite
- **Аутентификация**: Werkzeug Security

## Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/[ваш-username]/myshiftly.git
cd myshiftly
```

2. Создайте виртуальное окружение:
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# или
.venv\Scripts\activate     # Windows
```

3. Установите зависимости:
```bash
pip install -r requirements.txt
```

4. Запустите приложение:
```bash
python app.py
```

5. Откройте браузер и перейдите по адресу: `http://localhost:5000`

## Развертывание на PythonAnywhere

### Шаг 1: Подготовка GitHub репозитория

1. Создайте репозиторий на GitHub
2. Загрузите код:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/myshiftly.git
git push -u origin main
```

### Шаг 2: Настройка PythonAnywhere

1. Зарегистрируйтесь на [PythonAnywhere](https://www.pythonanywhere.com/)
2. Откройте Bash консоль
3. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/myshiftly.git
cd myshiftly
```

4. Создайте виртуальное окружение:
```bash
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Шаг 3: Настройка веб-приложения

1. Перейдите в раздел "Web" в панели управления PythonAnywhere
2. Нажмите "Add a new web app"
3. Выберите "Manual configuration" и Python 3.10
4. В настройках укажите:
   - **Source code**: `/home/yourusername/myshiftly`
   - **WSGI configuration file**: `/home/yourusername/myshiftly/wsgi.py`

### Шаг 4: Настройка WSGI файла

Отредактируйте `wsgi.py`, заменив:
- `yourusername` на ваш username на PythonAnywhere
- `your-production-secret-key-here` на безопасный секретный ключ

### Шаг 5: Настройка статических файлов

В разделе "Static files" добавьте:
- **URL**: `/static/`
- **Directory**: `/home/yourusername/myshiftly/static/`

### Шаг 6: Создание базы данных

В Bash консоли:
```bash
cd myshiftly
source .venv/bin/activate
python
>>> from app import app, db
>>> with app.app_context():
...     db.create_all()
>>> exit()
```

### Шаг 7: Запуск приложения

1. Нажмите "Reload" в разделе Web
2. Ваш сайт будет доступен по адресу `https://yourusername.pythonanywhere.com`

## Структура проекта

```
Calendar/
├── app.py              # Главный файл приложения
├── wsgi.py             # WSGI конфигурация для PythonAnywhere
├── config.py           # Конфигурация
├── models.py           # Модели базы данных
├── routes.py           # Маршруты и логика
├── requirements.txt    # Зависимости
├── database/           # База данных SQLite
├── static/            # Статические файлы (CSS, JS, изображения)
├── templates/         # HTML шаблоны
└── test/              # Тесты
```

## Использование

1. **Регистрация**: Создайте аккаунт с именем пользователя и email
2. **Создание календаря**: Создайте личный или командный календарь
3. **Добавление друзей**: Найдите и добавьте коллег в друзья
4. **Планирование смен**: Используйте шаблоны или создавайте смены вручную
5. **Управление командой**: Добавляйте участников в командные календари

## Обновление на PythonAnywhere

Для обновления приложения:

1. В Bash консоли:
```bash
cd myshiftly
git pull origin main
source .venv/bin/activate
pip install -r requirements.txt
```

2. Перезагрузите веб-приложение в панели управления

## Поддержка

При возникновении проблем:
1. Проверьте логи ошибок в разделе "Web" → "Error log"
2. Убедитесь, что все пути в `wsgi.py` указаны правильно
3. Проверьте права доступа к файлам базы данных

## Безопасность

- Пароли хешируются с помощью Werkzeug
- Защита от CSRF атак
- Валидация пользовательского ввода
- Безопасная загрузка файлов

## Лицензия

Этот проект защищен проприетарной лицензией - см. файл [LICENSE](LICENSE) для деталей.

**⚠️ ВАЖНО**: Использование, копирование, модификация или распространение этого программного обеспечения БЕЗ письменного разрешения автора ЗАПРЕЩЕНО и может повлечь юридическую ответственность.

## Автор

© 2025 Bbcmozze. Все права защищены.

---

⚠️ **ВНИМАНИЕ**: Этот проект является собственностью автора и защищен законами об авторском праве. Несанкционированное использование преследуется по закону.
