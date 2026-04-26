// ===== ЗАГРУЗКА И ОТРИСОВКА СООБЩЕНИЙ =====
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
    messages.forEach(msg => addMessageToContainer(msg, container));
    container.scrollTop = container.scrollHeight;
    isUserAtBottom = true;
}

function appendMessagesWithoutScroll(newMessages) {
    const container = document.getElementById('messages');
    if (!container || !newMessages || !newMessages.length) return;
    const wasAtBottom = isUserAtBottom;
    newMessages.forEach(msg => addMessageToContainer(msg, container));
    if (wasAtBottom) container.scrollTop = container.scrollHeight;
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
