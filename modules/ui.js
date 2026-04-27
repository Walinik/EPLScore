// ===== ОТОБРАЖЕНИЕ СПИСКА ЧАТОВ С DRAG & DROP =====

// Хранилище порядка чатов в localStorage
function saveChatOrder(order) {
    localStorage.setItem('epls_chat_order', JSON.stringify(order));
}

function loadChatOrder() {
    const saved = localStorage.getItem('epls_chat_order');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch(e) { return []; }
    }
    return [];
}

function saveChatOrderForAdmin(orderIds) {
    if (currentUser?.is_admin) {
        localStorage.setItem(`epls_chat_order_admin_${currentUser.id}`, JSON.stringify(orderIds));
    }
}

function loadChatOrderForAdmin() {
    if (currentUser?.is_admin) {
        const saved = localStorage.getItem(`epls_chat_order_admin_${currentUser.id}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch(e) { return []; }
        }
    }
    return [];
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
            li.setAttribute('data-room-id', roomId);
            li.setAttribute('data-user-id', admin.id);
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

    // Администратор: создаём список с Drag & Drop
    const requestsRoomId = getRequestsRoom(currentUser.id);
    
    // Собираем все элементы для сортировки
    let items = [];
    
    // Комната запросов (всегда первая, не перетаскивается)
    const requestsItem = {
        id: requestsRoomId,
        userId: 'requests',
        title: '🔔 ЗАПРОСЫ',
        isFixed: true,
        roomId: requestsRoomId
    };
    items.push(requestsItem);
    
    // Сотрудники
    employees.forEach(emp => {
        if (emp.id === currentUser.id) return;
        items.push({
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
        // Сначала фиксированный элемент
        const fixedItem = items.find(i => i.isFixed);
        if (fixedItem) orderedItems.push(fixedItem);
        // Остальные по сохранённому порядку
        for (const id of savedOrder) {
            const item = items.find(i => i.id === id && !i.isFixed);
            if (item) orderedItems.push(item);
        }
        // Добавляем новые элементы, которых нет в сохранённом порядке
        items.forEach(item => {
            if (!item.isFixed && !orderedItems.find(i => i.id === item.id)) {
                orderedItems.push(item);
            }
        });
        items = orderedItems;
    }
    
    // Создаём элементы списка
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.title;
        li.className = currentRoom === item.roomId ? 'active' : '';
        li.setAttribute('data-room-id', item.roomId);
        li.setAttribute('data-user-id', item.userId);
        li.setAttribute('data-item-id', item.id);
        
        // Фиксированные элементы (запросы) нельзя перетаскивать
        if (!item.isFixed) {
            li.draggable = true;
            li.style.cursor = 'grab';
            
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragend', handleDragEnd);
            li.addEventListener('dragover', handleDragOver);
            li.addEventListener('drop', handleDrop);
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

// Drag & Drop переменные
let dragSourceId = null;
let dragSourceElement = null;

function handleDragStart(e) {
    dragSourceId = e.target.getAttribute('data-item-id');
    dragSourceElement = e.target;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSourceId);
}

function handleDragEnd(e) {
    e.target.style.opacity = '';
    dragSourceId = null;
    dragSourceElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('li');
    if (target && target.getAttribute('data-item-id') !== dragSourceId) {
        target.style.borderTop = '2px solid #4bffc3';
    }
}

function handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest('li');
    if (target) target.style.borderTop = '';
    
    const targetId = target?.getAttribute('data-item-id');
    if (!dragSourceId || !targetId || dragSourceId === targetId) return;
    
    // Получаем список всех элементов
    const container = document.getElementById('chatList');
    const items = Array.from(container.children);
    
    const sourceIndex = items.findIndex(item => item.getAttribute('data-item-id') === dragSourceId);
    const targetIndex = items.findIndex(item => item.getAttribute('data-item-id') === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) return;
    
    // Получаем порядок из data-item-id
    const orderIds = items.map(item => item.getAttribute('data-item-id'));
    // Перемещаем элемент
    const [removed] = orderIds.splice(sourceIndex, 1);
    orderIds.splice(targetIndex, 0, removed);
    
    // Фильтруем фиксированные элементы (они не должны перемещаться)
    const fixedItemId = 'requests';
    const filteredOrder = orderIds.filter(id => id !== fixedItemId);
    
    // Сохраняем новый порядок
    saveChatOrderForAdmin(filteredOrder);
    
    // Перерисовываем список
    renderChatList();
    showToast('✅ Порядок чатов сохранён');
}
