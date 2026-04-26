// ===== ОТОБРАЖЕНИЕ СПИСКА ЧАТОВ =====
function renderChatList() {
    const container = document.getElementById('chatList');
    if (!container || !currentUser) return;
    container.innerHTML = '';

    if (!currentUser.is_admin) {
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

    // Админ: сначала вкладка "🔔 ЗАПРОСЫ"
    const requestsRoomId = `requests_${currentUser.id}`;
    const requestsLi = document.createElement('li');
    requestsLi.textContent = `🔔 ЗАПРОСЫ`;
    requestsLi.className = currentRoom === requestsRoomId ? 'active' : '';
    requestsLi.onclick = async () => {
        if (currentRoom !== requestsRoomId) {
            currentRoom = requestsRoomId;
            lastMessageTimestamp = 0;
            renderChatList();
            await loadFullMessages();
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

function updateUserInterface() {
    document.getElementById('userInfoDisplay').innerHTML = `👤 ${currentUser.display_name} | ${currentUser.position} | Уровень ${currentUser.level}`;
    document.getElementById('displayNameInput').value = currentUser.display_name;
    document.getElementById('eplsNameInput').value = currentUser.epls_name;
    
    const isAdmin = currentUser.is_admin === true;
    document.getElementById('adminPanel').classList.toggle('hidden', !isAdmin);
    document.getElementById('eplsNameRow').classList.toggle('hidden', !isAdmin);
    document.getElementById('chatSidebar').classList.toggle('hidden', !isAdmin);
    document.getElementById('eplsToggleContainer').classList.toggle('hidden', !isAdmin);
    
    if (!isAdmin) isEplsMode = false;
}
