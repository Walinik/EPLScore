// ===== СОСТОЯНИЕ =====
let currentUser = null;
let employees = [];
let currentRoom = null;
let isEplsMode = false;
let refreshInterval = null;
let lastMessageTimestamp = 0;
let isLoadingMessages = false;
let isUserAtBottom = true;

// ===== ВСПОМОГАТЕЛЬНЫЕ =====
function showToast(msg, isErr = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeftColor = isErr ? '#ff7a5e' : '#4bffc3';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// ===== КОМНАТЫ =====
function getPrivateRoom(user1, user2) {
    const ids = [user1.id, user2.id].sort();
    return `private_${ids[0]}_${ids[1]}`;
}

function getRequestsRoom(adminId) {
    return `requests_${adminId}`;
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
    if (!currentUser || !currentRoom || isLoadingMessages) return;
    
    isLoadingMessages = true;
    try {
        const query = `chat_messages?select=*&order=timestamp.asc&room=eq.${currentRoom}&timestamp=gt.${lastMessageTimestamp}`;
        const newMessages = await supabaseFetch(query);
        
        if (newMessages && newMessages.length > 0) {
            lastMessageTimestamp = newMessages[newMessages.length - 1].timestamp;
            appendMessagesWithoutScroll(newMessages);
        }
    } catch (e) {
        console.error('Load new messages error:', e);
    } finally {
        isLoadingMessages = false;
    }
}

async function loadFullMessages() {
    if (!currentUser || !currentRoom) return;
    
    const messages = await supabaseFetch(`chat_messages?select=*&order=timestamp.asc&room=eq.${currentRoom}`);
    if (messages && messages.length > 0) {
        lastMessageTimestamp = messages[messages.length - 1].timestamp;
    }
    renderFullMessages(messages);
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
    isUserAtBottom = true;
}

function appendMessagesWithoutScroll(newMessages) {
    const container = document.getElementById('messages');
    if (!container || !newMessages || !newMessages.length) return;
    
    const wasAtBottom = isUserAtBottom;
    
    newMessages.forEach(msg => {
        addMessageToContainer(msg, container);
    });
    
    if (wasAtBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

function addMessageToContainer(msg, container) {
    const div = document.createElement('div');
    div.className = `message ${msg.is_epls ? 'epls' : ''}`;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="author ${msg.is_epls ? 'epls' : 'normal'}">${escapeHtml(msg.author_name)} <span class="time">${time}</span></div><div class="text">${escapeHtml(msg.text)}</div>`;
    container.appendChild(div);
}

function initScrollTracking() {
    const container = document.getElementById('messages');
    if (!container) return;
    
    container.addEventListener('scroll', () => {
        const isBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
        isUserAtBottom = isBottom;
    });
}

// ===== ОТПРАВКА СООБЩЕНИЙ С ПОДДЕРЖКОЙ /ask =====
async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    // Команда /clear
    if (text === '/clear') {
        if (confirm('Вы уверены, что хотите очистить историю этого чата?')) {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?room=eq.${currentRoom}`, {
                method: 'DELETE',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            if (response.ok) {
                showToast('✅ Чат очищен');
                lastMessageTimestamp = 0;
                await loadFullMessages();
            } else {
                showToast('❌ Ошибка очистки', true);
            }
        }
        input.value = '';
        return;
    }

    // КОМАНДА /ask (только для сотрудников)
    if (text.startsWith('/ask ') && !currentUser.is_admin) {
        const question = text.substring(5).trim();
        if (!question) {
            showToast('❌ Введите вопрос после /ask', true);
            input.value = '';
            return;
        }

        // Находим администратора
        const admin = employees.find(e => e.is_admin === true);
        if (!admin) {
            showToast('❌ Администратор не найден в системе', true);
            input.value = '';
            return;
        }

        const requestsRoom = getRequestsRoom(admin.id);
        const askMessage = {
            id: Date.now().toString(),
            room: requestsRoom,
            author_id: currentUser.id,
            author_name: currentUser.display_name || currentUser.full_name,
            text: `📝 ЗАПРОС ОТ ${currentUser.display_name || currentUser.full_name}: ${question}`,
            is_epls: false,
            timestamp: Date.now()
        };

        const response = await supabasePost('chat_messages', askMessage);
        if (response.ok) {
            showToast(`✅ Запрос отправлен администратору`);
        } else {
            showToast('❌ Ошибка отправки запроса', true);
        }
        input.value = '';
        return;
    }

    // Обычное сообщение
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
        lastMessageTimestamp = newMsg.timestamp;
        const container = document.getElementById('messages');
        addMessageToContainer(newMsg, container);
        container.scrollTop = container.scrollHeight;
        isUserAtBottom = true;
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
        // Сотрудник: только личный чат с админом
        const admin = employees.find(e => e.is_admin === true);
        if (admin) {
            const roomId = getPrivateRoom(currentUser, admin);
            const li = document.createElement('li');
            li.textContent = `👤 ${admin.display_name || admin.full_name}`;
            li.className = currentRoom === roomId ? 'active' : '';
            li.onclick = async () => {
                if (currentRoom !== roomId) {
                    currentRoom = roomId;
                    lastMessageTimestamp = 0;
                    renderChatList();
                    await loadFullMessages();
                }
            };
            container.appendChild(li);
        }
        return;
    }

    // Админ: показываем личные чаты + комнату запросов
    const requestsRoomId = getRequestsRoom(currentUser.id);
    const requestsLi = document.createElement('li');
    requestsLi.textContent = `🔔 ЗАПРОСЫ (${getUnreadRequestsCount()})`;
    requestsLi.className = currentRoom === requestsRoomId ? 'active' : '';
    requestsLi.onclick = async () => {
        if (currentRoom !== requestsRoomId) {
            currentRoom = requestsRoomId;
            lastMessageTimestamp = 0;
            renderChatList();
            await loadFullMessages();
            markRequestsAsRead();
        }
    };
    container.appendChild(requestsLi);

    // Личные чаты с сотрудниками
    employees.forEach(emp => {
        if (emp.id === currentUser.id) return;
        const roomId = getPrivateRoom(currentUser, emp);
        const li = document.createElement('li');
        li.textContent = `👤 ${emp.display_name || emp.full_name}`;
        li.className = currentRoom === roomId ? 'active' : '';
        li.onclick = async () => {
            if (currentRoom !== roomId) {
                currentRoom = roomId;
                lastMessageTimestamp = 0;
                renderChatList();
                await loadFullMessages();
            }
        };
        container.appendChild(li);
    });
}

// Подсчёт непрочитанных запросов (для отображения в скобках)
function getUnreadRequestsCount() {
    // Простая реализация: возвращает 0, можно расширить
    return 0;
}

function markRequestsAsRead() {
    // Можно добавить логику отметки прочитанных
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
        saveBtn.onclick = async () => {
            const full_name = document.getElementById(`name_${id}`).value;
            const position = document.getElementById(`pos_${id}`).value;
            const password = document.getElementById(`pwd_${id}`).value;
            const level = document.getElementById(`lvl_${id}`).value;
            const is_admin = document.getElementById(`admin_${id}`).checked;

            const empTarget = employees.find(e => e.id === id);
            if (empTarget?.full_name === 'Системный Администратор' && !is_admin) {
                showToast('❌ Нельзя снять права у главного администратора', true);
                return;
            }

            const response = await supabasePatch('employees', id, { 
                full_name, position, password, level: parseInt(level), is_admin 
            });
            if (response.ok) {
                showToast(`✅ Обновлено`);
                await loadEmployees();
                renderAdminTable();
                renderChatList();
            } else {
                showToast('❌ Ошибка обновления', true);
            }
        };

        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️ Удалить';
        delBtn.className = 'btn-sm btn-del';
        delBtn.onclick = async () => {
            const empTarget = employees.find(e => e.id === id);
            if (!empTarget) return;
            if (empTarget.full_name === 'Системный Администратор') {
                showToast('❌ Нельзя удалить главного администратора', true);
                return;
            }
            if (confirm(`Удалить "${empTarget.full_name}"?`)) {
                const response = await supabaseDelete('employees', id);
                if (response.ok) {
                    showToast(`✅ Удалён`);
                    await loadEmployees();
                    renderAdminTable();
                    renderChatList();
                    if (currentRoom === getPrivateRoom(currentUser, empTarget)) {
                        const first = employees.find(e => e.id !== currentUser.id);
                        if (first) currentRoom = getPrivateRoom(currentUser, first);
                        lastMessageTimestamp = 0;
                        await loadFullMessages();
                    }
                } else {
                    showToast('❌ Ошибка удаления', true);
                }
            }
        };
        if (emp.full_name === 'Системный Администратор') delBtn.disabled = true;

        actCell.appendChild(saveBtn);
        actCell.appendChild(delBtn);
    });
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

// ===== НАСТРОЙКИ =====
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

// ===== ВХОД =====
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

    if (isAdmin) {
        renderAdminTable();
        // По умолчанию открываем комнату запросов для админа
        currentRoom = getRequestsRoom(currentUser.id);
    } else {
        const admin = employees.find(e => e.is_admin === true);
        if (admin) {
            currentRoom = getPrivateRoom(currentUser, admin);
        } else {
            showToast('❌ Администратор не найден', true);
            btn.disabled = false;
            btn.textContent = 'ВОЙТИ';
            return;
        }
    }

    lastMessageTimestamp = 0;
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
                const oldCount = employees.length;
                await loadEmployees();
                if (oldCount !== employees.length) {
                    renderAdminTable();
                    renderChatList();
                }
            }
        }
    }, 3000);
}

function logout() {
    if (refreshInterval) clearInterval(refreshInterval);
    currentUser = null;
    lastMessageTimestamp = 0;
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
initScrollTracking();
