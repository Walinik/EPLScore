// ===== КОМАНДЫ =====
async function handleClear() {
    if (!confirm('Вы уверены, что хотите очистить историю этого чата?')) return;
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/chat_messages?room=eq.${currentRoom}`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
        }
    });
    
    if (response.ok) {
        const container = document.getElementById('messages');
        container.innerHTML = '<div class="loading">Чат очищен. Напишите новое сообщение...</div>';
        lastMessageTimestamp = 0;
        showToast('✅ Чат успешно очищен');
    } else {
        showToast('❌ Ошибка очистки', true);
    }
}

async function handleAsk(text) {
    const question = text.substring(5).trim();
    if (!question) {
        showToast('❌ Введите вопрос после /ask', true);
        return;
    }
    
    const admin = employees.find(e => e.is_admin === true);
    if (!admin) {
        showToast('❌ Администратор не найден', true);
        return;
    }
    
    const requestsRoom = `requests_${admin.id}`;
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
}
