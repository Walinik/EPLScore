// ===== ГЛОБАЛЬНОЕ СОСТОЯНИЕ =====
let currentUser = null;
let employees = [];
let currentRoom = null;
let isEplsMode = false;
let refreshInterval = null;
let lastMessageTimestamp = 0;
let isLoadingMessages = false;
let isUserAtBottom = true;
let isSending = false;

// Новые переменные для авто-входа
let lastUserAutoSave = null;
const AUTO_LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут
