// ===== СОСТОЯНИЕ =====
let currentUser = null;
let employees = [];
let currentRoom = null;          // 'private_ИД' — только личные чаты
let isEplsMode = false;
let refreshInterval = null;

// ===== ВСПОМОГАТЕЛЬНЫЕ =====
function showToast(msg, isErr = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = isErr ? '#ff7a5e' : '#4bffc3';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// ===== ЗАПРОСЫ К SUPABASE =====
async function supabaseFetch(endpoint) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error('Fetch error:', e);
        showToast("Ошибка соединения с сервером", true);
        return [];
    }
}

async function supabasePost(endpoint, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    return res;
}

async function supabasePatch(endpoint, id, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    return res;
}

async function supabaseDelete(endpoint, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    return res;
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadEmployees() {
    const data = await supabaseFetch('employees?select=*');
    if (data && data.length) employees = data;
    return employees;
}

// Загружаем сообщения ТОЛЬКО для текущей приватной комнаты
async function loadMessages() {
    if (!currentUser || !currentRoom) return;
    // Загружаем сообщения строго для этой комнаты (и только эту)
    const messages = await supabaseFetch(`chat_messages?select=*&order=timestamp.asc&room=eq.${currentRoom}`);
    renderMessages(messages);
}

function renderMessages(messages) {
    const container = document.getElementById('messages');
    if (!container) return;
    if (!messages || !messages.length) {
        container.innerHTML = '<div class="loading">Нет сообщений. Напишите что-нибудь!</div>';
        return;
    }
    container.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.is_epls ? 'epls' : ''}`;
        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        div.innerHTML = `
            <div class="author ${msg.is_epls ? 'epls' : 'normal'}">${escapeHtml(msg.author_name)} <span class="time">${time}</span></div>
            <div class="text">${escapeHtml(msg.text)}</div>
        `;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const text = document.getElementById('msgInput').value.trim();
    if (!text) return;

    // Поддержка команды /clear
    if (text === '/clear') {
        if (confirm(`Вы уверены, что хотите очистить ВСЮ историю чата с этим сотрудником?`)) {
            await clearChat();
        }
        document.getElementById('msgInput').value = '';
        return;
    }

    const authorName = isEplsMode
        ? (currentUser.epls_name || '🤖 EPLS')
        : (currentUser.display_name || currentUser.full_name);

    const newMsg = {
        id: Date.now().toString(),
        room: currentRoom,
        author_id: currentUser.id,
        author_name: authorName,
        text: text,
        is_epls: isEplsMode,
        timestamp: Date.now()
    };

    const response = await supabasePost('chat_messages', newMsg);
    if (response.ok) {
        document.getElementById('msgInput').value = '';
        await loadMessages();
    } else {
        showToast("Ошибка отправки", true);
    }
}

// Функция очистки чата
async function clearChat() {
    if (!currentRoom) return;
    // Удаляем все сообщения в текущей комнате
    const response = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?room=eq.${currentRoom}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    if (response.ok) {
        showToast(`Чат очищен.`);
        await loadMessages(); // Обновляем отображение
    } else {
        showToast("Ошибка при очистке чата", true);
    }
}

// ===== АДМИН-ФУНКЦИИ =====
function renderChatList() {
    const container = document.getElementById('chatList');
    if (!container || !currentUser?.is_admin) return;

    container.innerHTML = '';
    employees.forEach(emp => {
        if (emp.id === currentUser.id) return;
        const privateRoom = `private_${emp.id}`;
        const li = document.createElement('li');
        li.textContent = `👤 ${emp.display_name || emp.full_name}`;
        li.className = currentRoom === privateRoom ? 'active' : '';
        li.onclick = async () => {
            currentRoom = privateRoom;
            renderChatList();
            await loadMessages();
        };
        container.appendChild(li);
    });
}

function renderAdminTable() {
    const tbody = document.getElementById('empTableBody');
    if (!tbody) return;
    if (!employees.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Нет сотрудников</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    employees.forEach(emp => {
        const row = tbody.insertRow();
        const id = emp.id;

        // ФИО
        const nameCell = row.insertCell(0);
        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.value = emp.full_name;
        nameInp.id = `name_${id}`;
        nameCell.appendChild(nameInp);

        // Должность
        const posCell = row.insertCell(1);
        const posInp = document.createElement('input');
        posInp.type = 'text';
        posInp.value = emp.position;
        posInp.id = `pos_${id}`;
        posCell.appendChild(posInp);

        // Пароль
        const pwdCell = row.insertCell(2);
        const pwdInp = document.createElement('input');
        pwdInp.type = 'password';
        pwdInp.value = emp.password;
        pwdInp.id = `pwd_${id}`;
        pwdCell.appendChild(pwdInp);

        // Уровень
        const lvlCell = row.insertCell(3);
        const lvlSel = document.createElement('select');
        lvlSel.id = `lvl_${id}`;
        for (let i = 1; i <= 5; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            if (emp.level == i) opt.selected = true;
            lvlSel.appendChild(opt);
        }
        lvlCell.appendChild(lvlSel);

        // Админ
        const adminCell = row.insertCell(4);
        const adminChk = document.createElement('input');
        adminChk.type = 'checkbox';
        adminChk.checked = emp.is_admin === true;
        adminChk.id = `admin_${id}`;
        adminCell.appendChild(adminChk);

        // Действия
        const actCell = row.insertCell(5);
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Сохранить';
        saveBtn.className = 'btn-sm';
        saveBtn.onclick = () => updateEmployee(id);

        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️ Удалить';
        delBtn.className = 'btn-sm btn-del';
        delBtn.onclick = () => deleteEmployee(id);
        if (emp.full_name === "Системный Администратор") delBtn.disabled = true;

        actCell.appendChild(saveBtn);
        actCell.appendChild(delBtn);
    });
}

async function updateEmployee(id) {
    const full_name = document.getElementById(`name_${id}`).value;
    const position = document.getElementById(`pos_${id}`).value;
    const password = document.getElementById(`pwd_${id}`).value;
    const level = document.getElementById(`lvl_${id}`).value;
    const is_admin = document.getElementById(`admin_${id}`).checked;

    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    if (emp.full_name === "Системный Администратор" && !is_admin) {
        showToast("❌ Нельзя снять права администратора", true);
        return;
    }

    const response = await supabasePatch('employees', id, {
        full_name,
        position,
        password,
        level: parseInt(level),
        is_admin
    });
    if (response.ok) {
        showToast(`✅ Данные сотрудника "${full_name}" обновлены`);
        await loadEmployees();
        renderAdminTable();
        renderChatList();
    } else {
        showToast("❌ Ошибка обновления", true);
    }
}

async function deleteEmployee(id) {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    if (emp.full_name === "Системный Администратор") {
        showToast("❌ Нельзя удалить главного администратора", true);
        return;
    }
    if (confirm(`Удалить сотрудника "${emp.full_name}"? Это действие необратимо.`)) {
        const response = await supabaseDelete('employees', id);
        if (response.ok) {
            showToast(`✅ ${emp.full_name} удалён`);
            await loadEmployees();
            renderAdminTable();
            renderChatList();
            // Если удалили сотрудника, с которым был открыт чат — переключаемся на первого
            if (currentRoom === `private_${id}` && employees.length > 0) {
                const firstEmp = employees.find(e => e.id !== currentUser.id);
                if (firstEmp) currentRoom = `private_${firstEmp.id}`;
                renderChatList();
                await loadMessages();
            }
        } else {
            showToast("❌ Ошибка удаления", true);
        }
    }
}

async function registerEmployee() {
    const full = document.getElementById('regFullname').value.trim();
    const pos = document.getElementById('regPosition').value.trim();
    const pwd = document.getElementById('regPassword').value.trim();
    const lvl = document.getElementById('regLevel').value;

    if (!full || !pos || !pwd) {
        showToast("❌ Заполните все поля", true);
        return;
    }
    if (employees.find(e => e.full_name === full)) {
        showToast("❌ Сотрудник с таким ФИО уже существует", true);
        return;
    }

    const newEmp = {
        id: Date.now().toString(),
        full_name: full,
        position: pos,
        password: pwd,
        level: parseInt(lvl),
        is_admin: false,
        display_name: full,
        epls_name: '🤖 EPLS'
    };

    const response = await supabasePost('employees', newEmp);
    if (response.ok) {
        showToast(`✅ ${full} добавлен в сеть`);
        document.getElementById('regFullname').value = '';
        document.getElementById('regPosition').value = '';
        document.getElementById('regPassword').value = '';
        await loadEmployees();
        renderAdminTable();
        renderChatList();
    } else {
        showToast("❌ Ошибка добавления", true);
    }
}

// ===== НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ =====
async function updateDisplayName() {
    const newName = document.getElementById('displayNameInput').value.trim();
    if (!newName) {
        showToast("Введите имя", true);
        return;
    }
    const response = await supabasePatch('employees', currentUser.id, { display_name: newName });
    if (response.ok) {
        currentUser.display_name = newName;
        document.getElementById('userInfoDisplay').innerHTML = `👤 ${currentUser.display_name} | ${currentUser.position} | Уровень ${currentUser.level}`;
        showToast(`✅ Ваше отображаемое имя изменено на "${newName}"`);
        renderChatList();
    } else {
        showToast("❌ Ошибка", true);
    }
}

async function updateEplsName() {
    const newName = document.getElementById('eplsNameInput').value.trim();
    if (!newName) {
        showToast("Введите имя бота", true);
        return;
    }
    const response = await supabasePatch('employees', currentUser.id, { epls_name: newName });
    if (response.ok) {
        currentUser.epls_name = newName;
        showToast(`✅ Имя бота EPLS изменено на "${newName}"`);
    } else {
        showToast("❌ Ошибка", true);
    }
}

async function changePassword() {
    const newPwd = document.getElementById('newPasswordInput').value.trim();
    if (!newPwd) {
        showToast("Введите новый пароль", true);
        return;
    }
    const response = await supabasePatch('employees', currentUser.id, { password: newPwd });
    if (response.ok) {
        showToast("✅ Ваш пароль успешно изменён");
        document.getElementById('newPasswordInput').value = '';
    } else {
        showToast("❌ Ошибка", true);
    }
}

// ===== ВХОД И ВЫХОД =====
async function login() {
    const fullname = document.getElementById('loginFullname').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!fullname || !password) {
        showToast("Введите ФИО и пароль", true);
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'ВХОД...';

    await loadEmployees();
    const user = employees.find(e => e.full_name === fullname && e.password === password);

    if (!user) {
        showToast("❌ Неверные ФИО или пароль", true);
        btn.disabled = false;
        btn.textContent = 'ВОЙТИ';
        return;
    }

    currentUser = user;
    if (!currentUser.display_name) currentUser.display_name = currentUser.full_name;
    if (!currentUser.epls_name) currentUser.epls_name = '🤖 EPLS';

    // Отображаем интерфейс
    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('mainInterface').classList.remove('hidden');
    document.getElementById('userInfoDisplay').innerHTML = `👤 ${currentUser.display_name} | ${currentUser.position} | Уровень ${currentUser.level}`;
    document.getElementById('displayNameInput').value = currentUser.display_name;
    document.getElementById('eplsNameInput').value = currentUser.epls_name;

    const isAdmin = currentUser.is_admin === true;
    document.getElementById('adminPanel').classList.toggle('hidden', !isAdmin);
    document.getElementById('eplsNameRow').classList.toggle('hidden', !isAdmin);
    document.getElementById('chatSidebar').classList.toggle('hidden', !isAdmin);

    // Загружаем данные для админа
    if (isAdmin) {
        renderAdminTable();
    }

    // Выбираем первый доступный чат
    if (isAdmin && employees.length > 0) {
        const firstEmp = employees.find(e => e.id !== currentUser.id);
        if (firstEmp) currentRoom = `private_${firstEmp.id}`;
    } else if (!isAdmin) {
        // Для сотрудника — его личный чат с админом (или создаём)
        const admin = employees.find(e => e.is_admin === true);
        if (admin) currentRoom = `private_${admin.id}`;
    }

    renderChatList();
    await loadMessages();
    startAutoRefresh();

    btn.disabled = false;
    btn.textContent = 'ВОЙТИ';
}

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
        if (currentUser) {
            await loadMessages();
            if (currentUser.is_admin) {
                await loadEmployees();
                renderAdminTable();
                renderChatList();
            }
        }
    }, 5000);
}

function logout() {
    if (refreshInterval) clearInterval(refreshInterval);
    currentUser = null;
    document.getElementById('mainInterface').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
    document.getElementById('loginFullname').value = '';
    document.getElementById('loginPassword').value = '';
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
document.getElementById('loginBtn').onclick = login;
document.getElementById('logoutBtn').onclick = logout;
document.getElementById('sendBtn').onclick = sendMessage;
document.getElementById('msgInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
document.getElementById('updateNameBtn').onclick = updateDisplayName;
document.getElementById('updateEplsNameBtn').onclick = updateEplsName;
document.getElementById('changePasswordBtn').onclick = changePassword;
document.getElementById('registerBtn').onclick = registerEmployee;

document.getElementById('eplsModeBtn').onclick = () => {
    isEplsMode = !isEplsMode;
    const btn = document.getElementById('eplsModeBtn');
    if (isEplsMode) {
        btn.innerHTML = '🤖 Писать как: EPLS';
        btn.classList.add('active');
    } else {
        btn.innerHTML = '👤 Писать как: Я';
        btn.classList.remove('active');
    }
    showToast(isEplsMode ? 'Вы пишете от имени бота EPLS' : 'Вы пишете от своего имени');
};

// Загружаем сотрудников при старте
loadEmployees();
