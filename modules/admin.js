// ===== АДМИН-ФУНКЦИИ =====

// Хранилище порядка сотрудников
const EMP_ORDER_KEY = 'epls_employees_order';

function saveEmployeesOrder(orderIds) {
    localStorage.setItem(EMP_ORDER_KEY, JSON.stringify(orderIds));
}

function loadEmployeesOrder() {
    const saved = localStorage.getItem(EMP_ORDER_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch(e) { return []; }
    }
    return [];
}

// Глобальные переменные для Drag & Drop
let draggedEmpId = null;

// Функция для обновления порядка в массиве и сохранения
function reorderEmployees(sourceId, targetId) {
    const sourceIndex = employees.findIndex(e => e.id === sourceId);
    const targetIndex = employees.findIndex(e => e.id === targetId);
    
    if (sourceIndex === -1 || targetIndex === -1) return false;
    
    // Перемещаем элемент
    const [movedEmp] = employees.splice(sourceIndex, 1);
    employees.splice(targetIndex, 0, movedEmp);
    
    // Сохраняем новый порядок
    const newOrder = employees.map(e => e.id);
    saveEmployeesOrder(newOrder);
    
    return true;
}

function renderAdminTable() {
    const tbody = document.getElementById('empTableBody');
    if (!tbody) return;
    if (!employees.length) {
        tbody.innerHTML = '<tr><td colspan="6">Нет сотрудников</td></tr>';
        return;
    }
    
    // Загружаем сохранённый порядок и сортируем employees
    const savedOrder = loadEmployeesOrder();
    if (savedOrder.length > 0) {
        const sortedEmployees = [];
        for (const id of savedOrder) {
            const emp = employees.find(e => e.id === id);
            if (emp) sortedEmployees.push(emp);
        }
        for (const emp of employees) {
            if (!sortedEmployees.find(e => e.id === emp.id)) {
                sortedEmployees.push(emp);
            }
        }
        employees = sortedEmployees;
    }
    
    tbody.innerHTML = '';
    employees.forEach(emp => {
        const row = tbody.insertRow();
        const id = emp.id;
        row.setAttribute('data-emp-id', id);
        row.setAttribute('draggable', 'true');
        row.style.cursor = 'grab';
        
        // Drag & Drop события
        row.addEventListener('dragstart', (e) => {
            draggedEmpId = id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
            row.classList.add('dragging');
        });
        
        row.addEventListener('dragend', (e) => {
            row.classList.remove('dragging');
            draggedEmpId = null;
        });
        
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const targetRow = e.target.closest('tr');
            if (targetRow && targetRow.getAttribute('data-emp-id') !== draggedEmpId) {
                targetRow.style.borderTop = '2px solid #4bffc3';
            }
        });
        
        row.addEventListener('dragleave', (e) => {
            const targetRow = e.target.closest('tr');
            if (targetRow) targetRow.style.borderTop = '';
        });
        
        row.addEventListener('drop', async (e) => {
            e.preventDefault();
            const targetRow = e.target.closest('tr');
            if (targetRow) targetRow.style.borderTop = '';
            
            const targetId = targetRow?.getAttribute('data-emp-id');
            if (draggedEmpId && targetId && draggedEmpId !== targetId) {
                const success = reorderEmployees(draggedEmpId, targetId);
                if (success) {
                    renderAdminTable(); // Перерисовываем таблицу
                    showToast('✅ Порядок сотрудников сохранён');
                }
            }
        });
        
        // ФИО
        const nameCell = row.insertCell(0);
        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.value = emp.full_name;
        nameInp.id = `name_${id}`;
        nameCell.appendChild(nameInp);
        
        // Должность
        const posCell = row.insertCell(1);
        const posInp = document.createElement('input');
        posInp.type = 'text';
        posInp.value = emp.position;
        posInp.id = `pos_${id}`;
        posCell.appendChild(posInp);
        
        // Пароль
        const pwdCell = row.insertCell(2);
        const pwdInp = document.createElement('input');
        pwdInp.type = 'password';
        pwdInp.value = emp.password;
        pwdInp.id = `pwd_${id}`;
        pwdCell.appendChild(pwdInp);
        
        // Уровень
        const lvlCell = row.insertCell(3);
        const lvlSel = document.createElement('select');
        lvlSel.id = `lvl_${id}`;
        for (let i = 1; i <= 5; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            if (emp.level === i) opt.selected = true;
            lvlSel.appendChild(opt);
        }
        lvlCell.appendChild(lvlSel);
        
        // Админ
        const adminCell = row.insertCell(4);
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = emp.is_admin === true;
        chk.id = `admin_${id}`;
        adminCell.appendChild(chk);
        
        // Действия
        const actCell = row.insertCell(5);
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Сохранить';
        saveBtn.className = 'btn-sm';
        saveBtn.onclick = async () => {
            const full_name = document.getElementById(`name_${id}`).value;
            const position = document.getElementById(`pos_${id}`).value;
            const password = document.getElementById(`pwd_${id}`).value;
            const level = document.getElementById(`lvl_${id}`).value;
            const is_admin = document.getElementById(`admin_${id}`).checked;
            
            const empTarget = employees.find(e => e.id === id);
            if (empTarget?.full_name === 'Системный Администратор' && !is_admin) {
                showToast('❌ Нельзя снять права', true);
                return;
            }
            
            const response = await supabasePatch('employees', id, {
                full_name, position, password, level: parseInt(level), is_admin
            });
            if (response.ok) {
                showToast(`✅ Обновлено`);
                await loadEmployees();
                renderAdminTable();
                if (typeof renderChatList === 'function') renderChatList();
            } else {
                showToast('❌ Ошибка', true);
            }
        };
        
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️ Удалить';
        delBtn.className = 'btn-sm btn-del';
        delBtn.onclick = async () => {
            const empTarget = employees.find(e => e.id === id);
            if (!empTarget) return;
            if (empTarget.full_name === 'Системный Администратор') {
                showToast('❌ Нельзя удалить', true);
                return;
            }
            if (confirm(`Удалить "${empTarget.full_name}"?`)) {
                const response = await supabaseDelete('employees', id);
                if (response.ok) {
                    showToast(`✅ Удалён`);
                    await loadEmployees();
                    renderAdminTable();
                    if (typeof renderChatList === 'function') renderChatList();
                    if (currentRoom === getPrivateRoom(currentUser.id, empTarget.id)) {
                        const first = employees.find(e => e.id !== currentUser.id);
                        if (first) currentRoom = getPrivateRoom(currentUser.id, first.id);
                        lastMessageTimestamp = 0;
                        if (typeof loadFullMessages === 'function') await loadFullMessages();
                    }
                } else {
                    showToast('❌ Ошибка', true);
                }
            }
        };
        if (emp.full_name === 'Системный Администратор') delBtn.disabled = true;
        
        actCell.appendChild(saveBtn);
        actCell.appendChild(delBtn);
    });
}

async function registerEmployee() {
    const full = document.getElementById('regFullname').value.trim();
    const pos = document.getElementById('regPosition').value.trim();
    const pwd = document.getElementById('regPassword').value.trim();
    const lvl = document.getElementById('regLevel').value;
    
    if (!full || !pos || !pwd) {
        showToast('❌ Заполните поля', true);
        return;
    }
    if (employees.find(e => e.full_name === full)) {
        showToast('❌ Сотрудник уже есть', true);
        return;
    }
    
    const newEmp = {
        id: Date.now().toString(),
        full_name: full,
        position: pos,
        password: pwd,
        level: parseInt(lvl),
        is_admin: false,
        display_name: full,
        epls_name: '🤖 EPLS'
    };

// После успешного обновления сотрудника
if (currentUser && currentUser.id === id) {
    currentUser.display_name = full_name;
    currentUser.position = position;
    currentUser.level = parseInt(level);
    currentUser.is_admin = is_admin;
    saveLastUser(currentUser);
}
    
    const response = await supabasePost('employees', newEmp);
    if (response.ok) {
        showToast(`✅ ${full} добавлен`);
        document.getElementById('regFullname').value = '';
        document.getElementById('regPosition').value = '';
        document.getElementById('regPassword').value = '';
        await loadEmployees();
        renderAdminTable();
        if (typeof renderChatList === 'function') renderChatList();
    } else {
        showToast('❌ Ошибка добавления', true);
    }
}

function getPrivateRoom(id1, id2) {
    const ids = [id1, id2].sort();
    return `private_${ids[0]}_${ids[1]}`;
}
