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

// Глобальная переменная для перетаскивания чатов
let draggedChatId = null;

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
            li.setAttribute('data-chat-id', admin.id);
            li.draggable = false;
            li.onclick = async () => {
                if (currentRoom !== roomId) {
                    currentRoom = roomId;
                    lastMessageTimestamp = 0;
                    renderChatList();
                    if (typeof loadFullMessages === 'function') await loadFullMessages();
                }
            };
            container.appendChild(li);
        }
        return;
    }

    // Администратор: строим список
    const requestsRoomId = getRequestsRoom(currentUser.id);
    
    let chatItems = [];
    
    // Комната запросов (фиксированная)
    chatItems.push({
        id: 'requests',
        title: '🔔 ЗАПРОСЫ',
        isFixed: true,
        roomId: requestsRoomId
    });
    
    // Сотрудники
    employees.forEach(emp => {
        if (emp.id === currentUser.id) return;
        chatItems.push({
            id: emp.id,
            title: `👤 ${emp.display_name || emp.full_name}`,
            isFixed: false,
            roomId: getPrivateRoom(currentUser.id, emp.id)
        });
    });
    
    // Загружаем сохранённый порядок
    const savedOrder = loadChatOrderForAdmin();
    if (savedOrder.length > 0) {
        const orderedItems = [];
        const fixedItem = chatItems.find(i => i.isFixed);
        if (fixedItem) orderedItems.push(fixedItem);
        for (const id of savedOrder) {
            const item = chatItems.find(i => i.id === id && !i.isFixed);
            if (item) orderedItems.push(item);
        }
        for (const item of chatItems) {
            if (!item.isFixed && !orderedItems.find(i => i.id === item.id)) {
                orderedItems.push(item);
            }
        }
        chatItems = orderedItems;
    }
    
    // Создаём элементы
    chatItems.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.title;
        li.className = currentRoom === item.roomId ? 'active' : '';
        li.setAttribute('data-chat-id', item.id);
        li.setAttribute('data-room-id', item.roomId);
        
        if (!item.isFixed) {
            li.draggable = true;
            li.style.cursor = 'grab';
            
            li.addEventListener('dragstart', (e) => {
                draggedChatId = item.id;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
                li.style.opacity = '0.5';
            });
            
            li.addEventListener('dragend', (e) => {
                li.style.opacity = '';
                draggedChatId = null;
            });
            
            li.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const target = e.target.closest('li');
                if (target && target.getAttribute('data-chat-id') !== draggedChatId) {
                    target.style.borderTop = '2px solid #4bffc3';
                }
            });
            
            li.addEventListener('dragleave', (e) => {
                const target = e.target.closest('li');
                if (target) target.style.borderTop = '';
            });
            
            li.addEventListener('drop', (e) => {
                e.preventDefault();
                const target = e.target.closest('li');
                if (target) target.style.borderTop = '';
                
                const targetId = target?.getAttribute('data-chat-id');
                if (draggedChatId && targetId && draggedChatId !== targetId && targetId !== 'requests') {
                    // Получаем все ID чатов (без фиксированного)
                    const allIds = chatItems.filter(i => !i.isFixed).map(i => i.id);
                    const sourceIndex = allIds.findIndex(id => id === draggedChatId);
                    const targetIndex = allIds.findIndex(id => id === targetId);
                    
                    if (sourceIndex !== -1 && targetIndex !== -1) {
                        const [removed] = allIds.splice(sourceIndex, 1);
                        allIds.splice(targetIndex, 0, removed);
                        saveChatOrderForAdmin(allIds);
                        renderChatList();
                        showToast('✅ Порядок чатов сохранён');
                    }
                }
            });
        } else {
            li.draggable = false;
            li.style.cursor = 'pointer';
        }
        
        li.onclick = async () => {
            if (currentRoom !== item.roomId) {
                currentRoom = item.roomId;
                lastMessageTimestamp = 0;
                renderChatList();
                if (typeof loadFullMessages === 'function') await loadFullMessages();
            }
        };
        
        container.appendChild(li);
    });
}
