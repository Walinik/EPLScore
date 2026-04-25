// ===== СОСТОЯНИЕ =====
let currentUser = null;
let employees = [];
let currentRoom = null;
let currentChatPartner = null;
let isEplsMode = false;
let refreshInterval = null;
let lastMessageId = null;

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

// ===== ГЕНЕРАЦИЯ УНИКАЛЬНОЙ КОМНАТЫ ДЛЯ ДВОИХ =====
function getPrivateRoom(userId1, userId2) {
    const ids = [userId1, userId2].sort();
    return `private_${ids[0]}_${ids[1]}`;
}

// ===== ЗАПРОСЫ К SUPABASE =====
async function supabaseFetch(endpoint) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error('Fetch error:', e);
        return [];
    }
}

async function supabasePost(endpoint, body) {
    return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function supabasePatch(endpoint, id, body) {
    return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function supabaseDelete(endpoint, id) {
    return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadEmployees() {
    const data = await supabaseFetch('employees?select=*');
    if (data && data.length) employees = data;
    return employees;
}

async function loadNewMessages() {
    if (!currentUser || !currentRoom) return;
    
    let query = `chat_messages?select=*&order=timestamp.asc&room=eq.${currentRoom}`;
    if (lastMessageId) {
        query = `chat_messages?select=*&order=timestamp.asc&room=eq.${currentRoom}&id=gt.${lastMessageId}`;
    }
    
    const newMessages = await supabaseFetch(query);
    if (newMessages && newMessages.length > 0) {
        lastMessageId = newMessages[newMessages.length - 1].id;
        appendMessages(newMessages);
    }
    return newMessages;
}

async function loadFullMessages() {
    if (!currentUser || !currentRoom) return;
    const messages = await supabaseFetch(`chat_messages?select=*&order=timestamp.asc&room=eq.${currentRoom}`);
    if (messages && messages.length > 0) {
        lastMessageId = messages[messages.length - 1].id;
    }
    renderFullMessages(messages);
    return messages;
}

function renderFullMessages(messages) {
    const container = document.getElementById('messages');
    if (!container) return;
    if (!messages || !messages.length) {
        container.innerHTML = '<div class="loading">Нет сообщений. Напишите что-нибудь!</div>';
        return;
    }
    container.innerHTML = '';
    messages.forEach(msg => {
        addMessageToContainer(msg, container);
    });
    container.scrollTop = container.scrollHeight;
}

function appendMessages(newMessages) {
    const container = document.getElementById('messages');
    if (!container) return;
    if (!newMessages || !newMessages.length) return;
    
    if (container.children.length === 0 || (container.children.length === 1 && container.children[0].classList?.contains('loading'))) {
        renderFullMessages(newMessages);
        return;
    }
    
    newMessages.forEach(msg => {
        addMessageToContainer(msg, container);
    });
    container.scrollTop = container.scrollHeight;
}

function addMessageToContainer(msg, container) {
    const div = document.createElement('div');
    div.className = `message ${msg.is_epls ? 'epls' : ''}`;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="author ${msg.is_epls ? 'epls' : 'normal'}">${escapeHtml(msg.author_name)} <span class="time">${time}</span></div><div class="text">${escapeHtml(msg.text)}</div>`;
    container.appendChild(div);
}

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    if (text === '/clear') {
        if (confirm('Вы уверены, что хотите очистить историю этого чата?')) {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?room=eq.${currentRoom}`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            if (response.ok) {
                showToast('✅ Чат очищен');
                lastMessageId = null;
                await loadFullMessages();
            } else {
                showToast('❌ Ошибка очистки', true);
            }
        }
        input.value = '';
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
        input.value = '';
        const container = document.getElementById('messages');
        addMessageToContainer(newMsg, container);
        container.scrollTop = container.scrollHeight;
        lastMessageId = newMsg.id;
    } else {
        showToast('❌ Ошибка отправки', true);
    }
}

// ===== ОТОБРАЖЕНИЕ СПИСКА ЧАТОВ =====
function renderChatList() {
    const container = document.getElementById('chatList');
    if (!container || !currentUser) return;
    container.innerHTML = '';

    if (!currentUser.is_admin) {
        // Сотрудник: показываем ТОЛЬКО ОДИН чат с администратором
        const admin = employees.find(e => e.is_admin === true);
        if (admin) {
            const roomId = getPrivateRoom(currentUser.id, admin.id);
            const li = document.createElement('li');
            li.textContent = `👤 ${admin.display_name || admin.full_name}`;
            li.className = currentRoom === roomId ? 'active' : '';
            // Только один чат, переключение не нужно, но оставим для единообразия
            li.onclick = async () => {
                if (currentRoom !== roomId) {
                    currentRoom = roomId;
                    currentChatPartner = admin;
                    lastMessageId = null;
                    renderChatList();
                    await loadFullMessages();
                }
            };
            container.appendChild(li);
        }
        return;
    }

    // Админ: показываем список всех сотрудников
    employees.forEach(emp => {
        if (emp.id === currentUser.id) return;
        const roomId = getPrivateRoom(currentUser.id, emp.id);
        const li = document.createElement('li');
        li.textContent = `👤 ${emp.display_name || emp.full_name}`;
        li.className = currentRoom === roomId ? 'active' : '';
        li.onclick = async () => {
            currentRoom = roomId;
            currentChatPartner = emp;
            lastMessageId = null;
            renderChatList();
            await loadFullMessages();
        };
        container.appendChild(li);
    });
}

// ===== АДМИН-ФУНКЦИИ =====
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

        const nameCell = row.insertCell(0);
        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.value = emp.full_name;
        nameInp.id = `name_${id}`;
        nameCell.appendChild(nameInp);

        const posCell = row.insertCell(1);
        const posInp = document.createElement('input');
        posInp.type = 'text';
        posInp.value = emp.position;
        posInp.id = `pos_${id}`;
        posCell.appendChild(posInp);

        const pwdCell = row.insertCell(2);
        const pwdInp = document.createElement('input');
        pwdInp.type = 'password';
        pwdInp.value = emp.password;
        pwdInp.id = `pwd_${id}`;
        pwdCell.appendChild(pwdInp);

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

        const adminCell = row.insertCell(4);
        const adminChk = document.createElement('input');
        adminChk.type = 'checkbox';
        adminChk.checked = emp.is_admin === true;
        adminChk.id = `admin_${id}`;
        adminCell.appendChild(adminChk);

        const actCell = row.insertCell(5);
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Сохранить';
        saveBtn.className = 'btn-sm';
        saveBtn.onclick = () => updateEmployee(id);

        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️ Удалить';
        delBtn.className = 'btn-sm btn-del';
        delBtn.onclick = () => deleteEmployee(id);
        if (emp.full_name === 'Системный Администратор') delBtn.disabled = true;

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
    if (emp?.full_name === 'Системный Администратор' && !is_admin) {
        showToast('❌ Нельзя снять права у главного администратора', true);
        return;
    }

    const response = await supabasePatch('employees', id, { full_name, position, password, level: parseInt(level), is_admin });
    if (response.ok) {
        showToast(`✅ Обновлено`);
        await loadEmployees();
        renderAdminTable();
        renderChatList();
    } else {
        showToast('❌ Ошибка обновления', true);
    }
}

async function deleteEmployee(id) {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    if (emp.full_name === 'Системный Администратор') {
        showToast('❌ Нельзя удалить главного администратора', true);
        return;
    }
    if (confirm(`Удалить "${emp.full_name}"?`)) {
        const response = await supabaseDelete('employees', id);
        if (response.ok) {
            showToast(`✅ Удалён`);
            await loadEmployees();
            renderAdminTable();
            renderChatList();
            if (currentChatPartner?.id === id) {
                const first = employees.find(e => e.id !== currentUser.id);
                if (first) {
                    currentRoom = getPrivateRoom(currentUser.id, first.id);
                    currentChatPartner = first;
                    await loadFullMessages();
                }
                renderChatList();
            }
        } else {
            showToast('❌ Ошибка удаления', true);
        }
    }
}

async function registerEmployee() {
    const full = document.getElementById('regFullname').value.trim();
    const pos = document.getElementById('regPosition').value.trim();
    const pwd = document.getElementById('regPassword').value.trim();
    const lvl = document.getElementById('regLevel').value;

    if (!full || !pos || !pwd) {
        showToast('❌ Заполните все поля', true);
        return;
    }
    if (employees.find(e => e.full_name === full)) {
        showToast('❌ Сотрудник уже существует', true);
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
        showToast(`✅ ${full} добавлен`);
        document.getElementById('regFullname').value = '';
        document.getElementById('regPosition').value = '';
        document.getElementById('regPassword').value = '';
        await loadEmployees();
        renderAdminTable();
        renderChatList();
    } else {
        showToast('❌ Ошибка добавления', true);
    }
}

// ===== НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ =====
async function updateDisplayName() {
    const newName = document.getElementById('displayNameInput').value.trim();
    if (!newName) { showToast('Введите имя', true); return; }
    const response = await supabasePatch('employees', currentUser.id, { display_name: newName });
    if (response.ok) {
        currentUser.display_name = newName;
        document.getElementById('userInfoDisplay').innerHTML = `👤 ${currentUser.display_name} | ${currentUser.position} | Уровень ${currentUser.level}`;
        showToast(`✅ Имя изменено на "${newName}"`);
        renderChatList();
    } else {
        showToast('❌ Ошибка', true);
    }
}

async function updateEplsName() {
    const newName = document.getElementById('eplsNameInput').value.trim();
    if (!newName) { showToast('Введите имя бота', true); return; }
    const response = await supabasePatch('employees', currentUser.id, { epls_name: newName });
    if (response.ok) {
        currentUser.epls_name = newName;
        showToast(`✅ Имя EPLS изменено на "${newName}"`);
    } else {
        showToast('❌ Ошибка', true);
    }
}

async function changePassword() {
    const newPwd = document.getElementById('newPasswordInput').value.trim();
    if (!newPwd) { showToast('Введите новый пароль', true); return; }
    const response = await supabasePatch('employees', currentUser.id, { password: newPwd });
    if (response.ok) {
        showToast('✅ Пароль изменён');
        document.getElementById('newPasswordInput').value = '';
    } else {
        showToast('❌ Ошибка', true);
    }
}

// ===== ВХОД И ВЫХОД =====
async function login() {
    const fullname = document.getElementById('loginFullname').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!fullname || !password) {
        showToast('Введите ФИО и пароль', true);
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'ВХОД...';

    await loadEmployees();
    const user = employees.find(e => e.full_name === fullname && e.password === password);

    if (!user) {
        showToast('❌ Неверные ФИО или пароль', true);
        btn.disabled = false;
        btn.textContent = 'ВОЙТИ';
        return;
    }

    currentUser = user;
    if (!currentUser.display_name) currentUser.display_name = currentUser.full_name;
    if (!currentUser.epls_name) currentUser.epls_name = '🤖 EPLS';

    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('mainInterface').classList.remove('hidden');
    document.getElementById('userInfoDisplay').innerHTML = `👤 ${currentUser.display_name} | ${currentUser.position} | Уровень ${currentUser.level}`;
    document.getElementById('displayNameInput').value = currentUser.display_name;
    document.getElementById('eplsNameInput').value = currentUser.epls_name;

    const isAdmin = currentUser.is_admin === true;
    document.getElementById('adminPanel').classList.toggle('hidden', !isAdmin);
    document.getElementById('eplsNameRow').classList.toggle('hidden', !isAdmin);
    document.getElementById('chatSidebar').classList.toggle('hidden', !isAdmin);
    
    const eplsContainer = document.getElementById('eplsToggleContainer');
    eplsContainer.classList.toggle('hidden', !isAdmin);
    if (!isAdmin) isEplsMode = false;

    // Выбор комнаты
    if (isAdmin) {
        renderAdminTable();
        const firstEmp = employees.find(e => e.id !== currentUser.id);
        if (firstEmp) {
            currentRoom = getPrivateRoom(currentUser.id, firstEmp.id);
            currentChatPartner = firstEmp;
        }
    } else {
        const admin = employees.find(e => e.is_admin === true);
        if (admin) {
            currentRoom = getPrivateRoom(currentUser.id, admin.id);
            currentChatPartner = admin;
        } else {
            showToast('❌ Администратор не найден в системе', true);
            btn.disabled = false;
            btn.textContent = 'ВОЙТИ';
            return;
        }
    }

    lastMessageId = null;
    renderChatList();
    await loadFullMessages();
    startAutoRefresh();

    btn.disabled = false;
    btn.textContent = 'ВОЙТИ';
}

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
        if (currentUser) {
            await loadNewMessages();
            if (currentUser.is_admin) {
                await loadEmployees();
                renderAdminTable();
                renderChatList();
            }
        }
    }, 3000);
}

function logout() {
    if (refreshInterval) clearInterval(refreshInterval);
    currentUser = null;
    lastMessageId = null;
    document.getElementById('mainInterface').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
    document.getElementById('loginFullname').value = '';
    document.getElementById('loginPassword').value = '';
}

// ===== ОБРАБОТЧИКИ =====
document.getElementById('loginBtn').onclick = login;
document.getElementById('logoutBtn').onclick = logout;
document.getElementById('sendBtn').onclick = sendMessage;
document.getElementById('msgInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
document.getElementById('updateNameBtn').onclick = updateDisplayName;
document.getElementById('updateEplsNameBtn').onclick = updateEplsName;
document.getElementById('changePasswordBtn').onclick = changePassword;
document.getElementById('registerBtn').onclick = registerEmployee;

document.getElementById('eplsModeBtn').onclick = () => {
    if (!currentUser?.is_admin) return;
    isEplsMode = !isEplsMode;
    const btn = document.getElementById('eplsModeBtn');
    if (isEplsMode) {
        btn.innerHTML = '🤖 Писать как: EPLS';
        btn.classList.add('active');
    } else {
        btn.innerHTML = '👤 Писать как: Я';
        btn.classList.remove('active');
    }
    showToast(isEplsMode ? 'Вы пишете от имени EPLS' : 'Вы пишете от своего имени');
};

loadEmployees();
