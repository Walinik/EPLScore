// ===== ОТОБРАЖЕНИЕ СПИСКА ЧАТОВ =====
function renderChatList() {
    const container = document.getElementById('chatList');
    if (!container || !currentUser) return;
    container.innerHTML = '';

    // Для сотрудника — только чат с администратором
    if (!currentUser.is_admin) {
        const admin = employees.find(e => e.is_admin === true);
        if (admin) {
            const roomId = getPrivateRoom(currentUser.id, admin.id);
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

    // Администратор: показываем комнату запросов и всех сотрудников
    const requestsRoomId = getRequestsRoom(currentUser.id);
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

    // Список всех сотрудников (кроме самого админа)
    employees.forEach(emp => {
        if (emp.id === currentUser.id) return;
        const roomId = getPrivateRoom(currentUser.id, emp.id);
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
