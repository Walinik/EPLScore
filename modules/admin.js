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

// Переменные для Drag & Drop
let dragSourceEmpId = null;
let dragSourceRowIndex = null;

function handleEmpDragStart(e, empId, rowIndex) {
    dragSourceEmpId = empId;
    dragSourceRowIndex = rowIndex;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', empId);
    e.target.closest('tr')?.classList.add('dragging');
}

function handleEmpDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const row = e.target.closest('tr');
    if (row && row.getAttribute('data-emp-id') !== dragSourceEmpId) {
        row.style.borderTop = '2px solid #4bffc3';
    }
}

function handleEmpDragLeave(e) {
    const row = e.target.closest('tr');
    if (row) {
        row.style.borderTop = '';
    }
}

function handleEmpDrop(e, targetEmpId) {
    e.preventDefault();
    const rows = document.querySelectorAll('#empTableBody tr');
    rows.forEach(row => row.style.borderTop = '');
    
    if (!dragSourceEmpId || dragSourceEmpId === targetEmpId) {
        dragSourceEmpId = null;
        dragSourceRowIndex = null;
        return;
    }
    
    // Находим индексы в текущем отображаемом массиве employees
    // Используем g employees (глобальный массив)
    const sourceIndex = employees.findIndex(e => e.id === dragSourceEmpId);
    const targetIndex = employees.findIndex(e => e.id === targetEmpId);
    
    if (sourceIndex === -1 || targetIndex === -1) {
        dragSourceEmpId = null;
        dragSourceRowIndex = null;
        return;
    }
    
    // Перемещаем элемент в массиве
    const [movedEmp] = employees.splice(sourceIndex, 1);
    employees.splice(targetIndex, 0, movedEmp);
    
    // Сохраняем новый порядок ID
    const newOrder = employees.map(e => e.id);
    saveEmployeesOrder(newOrder);
    
    // Перерисовываем таблицу
    renderAdminTable();
    showToast('✅ Порядок сотрудников сохранён');
    
    dragSourceEmpId = null;
    dragSourceRowIndex = null;
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
        // Сначала добавляем по сохранённому порядку
        for (const id of savedOrder) {
            const emp = employees.find(e => e.id === id);
            if (emp) sortedEmployees.push(emp);
        }
        // Добавляем новых сотрудников, которых нет в сохранённом порядке
        for (const emp of employees) {
            if (!sortedEmployees.find(e => e.id === emp.id)) {
                sortedEmployees.push(emp);
            }
        }
        employees = sortedEmployees;
    }
    
    tbody.innerHTML = '';
    employees.forEach((emp, idx) => {
        const row = tbody.insertRow();
        const id = emp.id;
        row.setAttribute('data-emp-id', id);
        row.setAttribute('data-emp-index', idx);
        row.setAttribute('draggable', 'true');
        row.style.cursor = 'grab';
        
        // Drag & Drop события
        row.addEventListener('dragstart', (e) => handleEmpDragStart(e, id, idx));
        row.addEventListener('dragend', (e) => {
            e.target.closest('tr')?.classList.remove('dragging');
            dragSourceEmpId = null;
            dragSourceRowIndex = null;
        });
        row.addEventListener('dragover', handleEmpDragOver);
        row.addEventListener('dragleave', handleEmpDragLeave);
        row.addEventListener('drop', (e) => handleEmpDrop(e, id));
        
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
            if (emp.level == i) opt.selected = true;
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
                renderChatList();
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
                    renderChatList();
                    // Если удалили текущий чат — переключаемся на первый
                    if (currentRoom === getPrivateRoom(currentUser.id, empTarget.id)) {
                        const first = employees.find(e => e.id !== currentUser.id);
                        if (first) currentRoom = getPrivateRoom(currentUser.id, first.id);
                        lastMessageTimestamp = 0;
                        await loadFullMessages();
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
    
    const response = await supabasePost('employees', newEmp);
    if (response.ok) {
        showToast(`✅ ${full} добавлен`);
        document.getElementById('regFullname').value = '';
        document.getElementById('regPosition').value = '';
        document.getElementById('regPassword').value = '';
        await loadEmployees();
        renderAdminTable();
        renderChatList();
    } else {
        showToast('❌ Ошибка добавления', true);
    }
}
