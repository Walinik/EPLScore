// ===== ОТОБРАЖЕНИЕ СПИСКА ЧАТОВ С DRAG & DROP =====

const CHAT_ORDER_KEY_PREFIX = 'epls_chat_order_admin_';

function saveChatOrderForAdmin(orderIds) {
    if (currentUser?.is_admin) {
        localStorage.setItem(`${CHAT_ORDER_KEY_PREFIX}${currentUser.id}`, JSON.stringify(orderIds));
    }
}

function loadChatOrderForAdmin() {
    if (currentUser?.is_admin) {
        const saved = localStorage.getItem(`${CHAT_ORDER_KEY_PREFIX}${currentUser.id}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch(e) { return []; }
        }
    }
    return [];
}

// Drag & Drop переменные для чатов
let dragSourceChatId = null;

function handleChatDragStart(e, chatId) {
    dragSourceChatId = chatId;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', chatId);
}

function handleChatDragEnd(e) {
    e.target.style.opacity = '';
    dragSourceChatId = null;
}

function handleChatDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('li');
    if (target && target.getAttribute('data-chat-id') !== dragSourceChatId) {
        target.style.borderTop = '2px solid #4bffc3';
    }
}

function handleChatDragLeave(e) {
    const target = e.target.closest('li');
    if (target) target.style.borderTop = '';
}

function handleChatDrop(e, targetChatId) {
    e.preventDefault();
    const target = e.target.closest('li');
    if (target) target.style.borderTop = '';
    
    if (!dragSourceChatId || dragSourceChatId === targetChatId) return;
    
    // Получаем все ID чатов из текущего DOM
    const container = document.getElementById('chatList');
    const items = Array.from(container.children);
    const chatIds = items.map(item => item.getAttribute('data-chat-id'));
    
    const sourceIndex = chatIds.findIndex(id => id === dragSourceChatId);
    const targetIndex = chatIds.findIndex(id => id === targetChatId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;
    
    // Перемещаем
    const [removed] = chatIds.splice(sourceIndex, 1);
    chatIds.splice(targetIndex, 0, removed);
    
    // Сохраняем порядок (исключая фиксированный чат "requests")
    const filteredOrder = chatIds.filter(id => id !== 'requests');
    saveChatOrderForAdmin(filteredOrder);
    
    // Перерисовываем
    renderChatList();
    showToast('✅ Порядок чатов сохранён');
}

function renderChatList() {
    const container = document.getElementById('chatList');
    if (!container || !currentUser) return;
    container.innerHTML = '';

    // Для сотрудника — только чат с администратором (без перетаскивания)
    if (!currentUser.is_admin) {
        const admin = employees.find(e => e.is_admin === true);
        if (admin) {
            const roomId = getPrivateRoom(currentUser.id, admin.id);
            const li = document.createElement('li');
            li.textContent = `👤 ${admin.display_name || admin.full_name}`;
            li.className = currentRoom === roomId ? 'active' : '';
            li.setAttribute('data-chat-id', admin.id);
            li.draggable = false;
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

    // Администратор: строим список с Drag & Drop
    const requestsRoomId = getRequestsRoom(currentUser.id);
    
    // Формируем массив чатов
    let chatItems = [];
    
    // Комната запросов (фиксированная, первая)
    chatItems.push({
        id: 'requests',
        userId: 'requests',
        title: '🔔 ЗАПРОСЫ',
        isFixed: true,
        roomId: requestsRoomId
    });
    
    // Сотрудники
    employees.forEach(emp => {
        if (emp.id === currentUser.id) return;
        chatItems.push({
            id: emp.id,
            userId: emp.id,
            title: `👤 ${emp.display_name || emp.full_name}`,
            isFixed: false,
            roomId: getPrivateRoom(currentUser.id, emp.id)
        });
    });
    
    // Загружаем сохранённый порядок
    const savedOrder = loadChatOrderForAdmin();
    if (savedOrder.length > 0) {
        const orderedItems = [];
        // Фиксированный элемент всегда первый
        const fixedItem = chatItems.find(i => i.isFixed);
        if (fixedItem) orderedItems.push(fixedItem);
        // Остальные по сохранённому порядку
        for (const id of savedOrder) {
            const item = chatItems.find(i => i.id === id && !i.isFixed);
            if (item) orderedItems.push(item);
        }
        // Добавляем новых сотрудников, которых нет в сохранённом порядке
        chatItems.forEach(item => {
            if (!item.isFixed && !orderedItems.find(i => i.id === item.id)) {
                orderedItems.push(item);
            }
        });
        chatItems = orderedItems;
    }
    
    // Создаём элементы списка
    chatItems.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.title;
        li.className = currentRoom === item.roomId ? 'active' : '';
        li.setAttribute('data-chat-id', item.id);
        li.setAttribute('data-room-id', item.roomId);
        
        if (!item.isFixed) {
            li.draggable = true;
            li.style.cursor = 'grab';
            li.addEventListener('dragstart', (e) => handleChatDragStart(e, item.id));
            li.addEventListener('dragend', handleChatDragEnd);
            li.addEventListener('dragover', handleChatDragOver);
            li.addEventListener('dragleave', handleChatDragLeave);
            li.addEventListener('drop', (e) => handleChatDrop(e, item.id));
        } else {
            li.draggable = false;
            li.style.cursor = 'pointer';
        }
        
        li.onclick = async () => {
            if (currentRoom !== item.roomId) {
                currentRoom = item.roomId;
                lastMessageTimestamp = 0;
                renderChatList();
                await loadFullMessages();
            }
        };
        
        container.appendChild(li);
    });
}
