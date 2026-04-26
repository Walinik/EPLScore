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
