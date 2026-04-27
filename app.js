// ===== ГЛАВНЫЙ ФАЙЛ =====

// Дополнительные функции
function getPrivateRoom(id1, id2) {
    const ids = [id1, id2].sort();
    return `private_${ids[0]}_${ids[1]}`;
}

function getRequestsRoom(adminId) {
    return `requests_${adminId}`;
}

async function loadEmployees() {
    const data = await supabaseFetch('employees?select=*');
    if (data && data.length) {
        employees = data;
        console.log('✅ Загружено сотрудников:', employees.length);
        console.log('📋 Список:', employees.map(e => ({ name: e.full_name, id: e.id, is_admin: e.is_admin })));
    }
    return employees;
}

async function sendMessage() {
    if (isSending) return;
    
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;
    
    isSending = true;
    
    try {
        if (text === '/clear') {
            await handleClear();
            input.value = '';
            return;
        }
        
        if (text.startsWith('/ask ') && !currentUser.is_admin) {
            await handleAsk(text);
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
            lastMessageTimestamp = newMsg.timestamp;
            const container = document.getElementById('messages');
            addMessageToContainer(newMsg, container);
            container.scrollTop = container.scrollHeight;
            isUserAtBottom = true;
        } else {
            showToast('❌ Ошибка отправки', true);
        }
    } finally {
        setTimeout(() => { isSending = false; }, 500);
    }
}

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
        showToast('❌ Неверные данные', true);
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
    document.getElementById('eplsToggleContainer').classList.toggle('hidden', !isAdmin);
    
    if (!isAdmin) isEplsMode = false;
    
    // Выбор комнаты
    if (isAdmin) {
        renderAdminTable();
        currentRoom = getRequestsRoom(currentUser.id);
        console.log('👑 Админ открыл комнату запросов:', currentRoom);
    } else {
        const admin = employees.find(e => e.is_admin === true);
        if (admin) {
            currentRoom = getPrivateRoom(currentUser.id, admin.id);
            console.log('👤 Сотрудник открыл чат с админом:', currentRoom);
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
    
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
        if (currentUser) {
            await loadNewMessages();
            if (currentUser.is_admin && employees.length) {
                const oldCount = employees.length;
                await loadEmployees();
                if (oldCount !== employees.length) {
                    renderAdminTable();
                    renderChatList();
                }
            }
        }
    }, 3000);
    
    btn.disabled = false;
    btn.textContent = 'ВОЙТИ';
}

function logout() {
    if (refreshInterval) clearInterval(refreshInterval);
    currentUser = null;
    document.getElementById('mainInterface').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
    document.getElementById('loginFullname').value = '';
    document.getElementById('loginPassword').value = '';
}

// ===== ОБРАБОТЧИКИ =====
document.getElementById('loginBtn').onclick = login;
document.getElementById('logoutBtn').onclick = logout;
document.getElementById('sendBtn').onclick = sendMessage;
document.getElementById('msgInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

document.getElementById('updateNameBtn').onclick = async () => {
    const newName = document.getElementById('displayNameInput').value.trim();
    if (!newName) { showToast('Введите имя', true); return; }
    const response = await supabasePatch('employees', currentUser.id, { display_name: newName });
    if (response.ok) {
        currentUser.display_name = newName;
        document.getElementById('userInfoDisplay').innerHTML = `👤 ${currentUser.display_name} | ${currentUser.position} | Уровень ${currentUser.level}`;
        showToast(`✅ Имя изменено на "${newName}"`);
        renderChatList();
    }
};

document.getElementById('updateEplsNameBtn').onclick = async () => {
    const newName = document.getElementById('eplsNameInput').value.trim();
    if (!newName) { showToast('Введите имя бота', true); return; }
    const response = await supabasePatch('employees', currentUser.id, { epls_name: newName });
    if (response.ok) {
        currentUser.epls_name = newName;
        showToast(`✅ Имя EPLS изменено на "${newName}"`);
    }
};

document.getElementById('changePasswordBtn').onclick = async () => {
    const newPwd = document.getElementById('newPasswordInput').value.trim();
    if (!newPwd) { showToast('Введите новый пароль', true); return; }
    const response = await supabasePatch('employees', currentUser.id, { password: newPwd });
    if (response.ok) {
        showToast('✅ Пароль изменён');
        document.getElementById('newPasswordInput').value = '';
    }
};

document.getElementById('registerBtn').onclick = registerEmployee;

document.getElementById('eplsModeBtn').onclick = () => {
    if (!currentUser?.is_admin) return;
    isEplsMode = !isEplsMode;
    const btn = document.getElementById('eplsModeBtn');
    btn.innerHTML = isEplsMode ? '🤖 Писать как: EPLS' : '👤 Писать как: Я';
    btn.classList.toggle('active', isEplsMode);
    showToast(isEplsMode ? 'Вы пишете от имени EPLS' : 'Вы пишете от своего имени');
};

// Запуск
loadEmployees();
initScrollTracking();
