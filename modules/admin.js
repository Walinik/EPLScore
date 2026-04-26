// ===== АДМИН-ФУНКЦИИ =====
function renderAdminTable() {
    const tbody = document.getElementById('empTableBody');
    if (!tbody) return;
    if (!employees.length) {
        tbody.innerHTML = '<tr><td colspan="6">Нет сотрудников</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    employees.forEach(emp => {
        const row = tbody.insertRow();
        const id = emp.id;
        
        row.insertCell(0).innerHTML = `<input type="text" id="name_${id}" value="${escapeHtml(emp.full_name)}">`;
        row.insertCell(1).innerHTML = `<input type="text" id="pos_${id}" value="${escapeHtml(emp.position)}">`;
        row.insertCell(2).innerHTML = `<input type="password" id="pwd_${id}" value="${emp.password}">`;
        
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
        
        const adminCell = row.insertCell(4);
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = emp.is_admin === true;
        chk.id = `admin_${id}`;
        adminCell.appendChild(chk);
        
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
                    if (currentRoom === getPrivateRoom(currentUser, empTarget)) {
                        const first = employees.find(e => e.id !== currentUser.id);
                        if (first) currentRoom = getPrivateRoom(currentUser, first);
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
