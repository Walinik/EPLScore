from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

# Подключение к базе данных PostgreSQL
def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get('PGHOST'),
        database=os.environ.get('PGDATABASE'),
        user=os.environ.get('PGUSER'),
        password=os.environ.get('PGPASSWORD'),
        port=os.environ.get('PGPORT', 5432),
        cursor_factory=RealDictCursor
    )

# Инициализация таблиц
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Таблица сотрудников
    cur.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id VARCHAR(50) PRIMARY KEY,
            full_name TEXT NOT NULL,
            position TEXT NOT NULL,
            password TEXT NOT NULL,
            level INTEGER DEFAULT 1,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Таблица чата
    cur.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Проверяем, есть ли главный админ
    cur.execute("SELECT * FROM employees WHERE full_name = 'Системный Администратор'")
    admin = cur.fetchone()
    if not admin:
        cur.execute('''
            INSERT INTO employees (id, full_name, position, password, level, is_admin)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (str(uuid.uuid4()), 'Системный Администратор', 'Глава сети', 'admin123', 5, True))
    
    conn.commit()
    cur.close()
    conn.close()

# API: получить всех сотрудников
@app.route('/api/employees', methods=['GET'])
def get_employees():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, full_name, position, level, is_admin FROM employees ORDER BY full_name")
    employees = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(employees)

# API: регистрация нового сотрудника
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    full_name = data.get('full_name')
    position = data.get('position')
    password = data.get('password')
    
    if not full_name or not position or not password:
        return jsonify({'error': 'Все поля обязательны'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Проверяем, существует ли уже
    cur.execute("SELECT * FROM employees WHERE full_name = %s", (full_name,))
    existing = cur.fetchone()
    if existing:
        cur.close()
        conn.close()
        return jsonify({'error': 'Сотрудник с таким ФИО уже существует'}), 400
    
    emp_id = str(uuid.uuid4())
    cur.execute('''
        INSERT INTO employees (id, full_name, position, password, level, is_admin)
        VALUES (%s, %s, %s, %s, %s, %s)
    ''', (emp_id, full_name, position, password, 1, False))
    
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'success': True, 'message': f'{full_name} добавлен'})

# API: обновление уровня и прав администратора
@app.route('/api/update_user', methods=['POST'])
def update_user():
    data = request.json
    emp_id = data.get('id')
    level = data.get('level')
    is_admin = data.get('is_admin')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Нельзя снять админку с главного админа
    if is_admin == False:
        cur.execute("SELECT full_name, is_admin FROM employees WHERE id = %s", (emp_id,))
        emp = cur.fetchone()
        if emp and emp['full_name'] == 'Системный Администратор' and emp['is_admin'] == True:
            cur.close()
            conn.close()
            return jsonify({'error': 'Нельзя снять права с главного администратора'}), 400
    
    cur.execute("UPDATE employees SET level = %s, is_admin = %s WHERE id = %s", (level, is_admin, emp_id))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'success': True})

# API: удаление сотрудника
@app.route('/api/delete_user', methods=['POST'])
def delete_user():
    data = request.json
    emp_id = data.get('id')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Проверяем, не главный ли админ
    cur.execute("SELECT full_name, is_admin FROM employees WHERE id = %s", (emp_id,))
    emp = cur.fetchone()
    if emp and emp['full_name'] == 'Системный Администратор' and emp['is_admin'] == True:
        cur.close()
        conn.close()
        return jsonify({'error': 'Нельзя удалить главного администратора'}), 400
    
    cur.execute("DELETE FROM employees WHERE id = %s", (emp_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'success': True})

# API: получить сообщения чата
@app.route('/api/chat', methods=['GET'])
def get_chat():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT author, text, timestamp FROM chat_messages ORDER BY timestamp ASC LIMIT 200")
    messages = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(messages)

# API: отправить сообщение в чат
@app.route('/api/chat', methods=['POST'])
def send_chat():
    data = request.json
    author = data.get('author')
    text = data.get('text')
    
    if not author or not text:
        return jsonify({'error': 'Автор и текст обязательны'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO chat_messages (author, text) VALUES (%s, %s)", (author, text))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'success': True})

# API: проверка пароля (для входа)
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    full_name = data.get('full_name')
    password = data.get('password')
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, full_name, position, level, is_admin FROM employees WHERE full_name = %s AND password = %s", (full_name, password))
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if user:
        return jsonify({'success': True, 'user': user})
    else:
        return jsonify({'error': 'Неверное ФИО или пароль'}), 401

# Запуск
if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
