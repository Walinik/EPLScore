// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
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
