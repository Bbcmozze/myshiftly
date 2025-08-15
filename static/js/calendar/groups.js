// Глобальные переменные
let currentCalendarId = null;
let selectedGroupColor = 'badge-color-1';
let selectedEditGroupColor = 'badge-color-1';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Groups.js: DOM loaded, initializing...'); // Для отладки
    
    // Получаем ID календаря из URL
    const urlParts = window.location.pathname.split('/');
    currentCalendarId = parseInt(urlParts[urlParts.length - 1]);
    console.log('Calendar ID:', currentCalendarId); // Для отладки
    
    initializeGroups();
});

function initializeGroups() {
    console.log('Initializing groups...'); // Для отладки
    
    // Кнопка создания группы
    const createGroupBtn = document.getElementById('createGroupBtn');
    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', openCreateGroupModal);
        console.log('Create group button found and configured'); // Для отладки
    } else {
        console.warn('Create group button not found'); // Для отладки
    }

    // Кнопка сохранения группы
    const saveGroupBtn = document.getElementById('saveGroupBtn');
    if (saveGroupBtn) {
        saveGroupBtn.addEventListener('click', createGroup);
        console.log('Save group button found and configured'); // Для отладки
    } else {
        console.warn('Save group button not found'); // Для отладки
    }

    // Кнопка обновления группы
    const updateGroupBtn = document.getElementById('updateGroupBtn');
    if (updateGroupBtn) {
        updateGroupBtn.addEventListener('click', updateGroup);
        console.log('Update group button found and configured'); // Для отладки
    } else {
        console.warn('Update group button not found'); // Для отладки
    }

    // Кнопка подтверждения удаления группы
    const confirmDeleteGroupBtn = document.getElementById('confirmDeleteGroupBtn');
    if (confirmDeleteGroupBtn) {
        confirmDeleteGroupBtn.addEventListener('click', confirmDeleteGroup);
        console.log('Confirm delete group button found and configured'); // Для отладки
    } else {
        console.warn('Confirm delete group button not found'); // Для отладки
    }

    // Поиск по группам
    const searchGroupInput = document.getElementById('searchGroupInput');
    if (searchGroupInput) {
        searchGroupInput.addEventListener('input', filterGroups);
        console.log('Search group input found and configured'); // Для отладки
    } else {
        console.warn('Search group input not found'); // Для отладки
    }

    // Обработчики для кнопок редактирования и удаления групп
    document.addEventListener('click', function(e) {
        // Проверяем, является ли кликнутый элемент кнопкой или его дочерним элементом
        const editBtn = e.target.closest('.edit-group-btn');
        const deleteBtn = e.target.closest('.delete-group-btn');
        
        if (editBtn) {
            const groupId = editBtn.dataset.groupId;
            console.log('Edit group clicked:', groupId); // Для отладки
            openEditGroupModal(groupId);
        } else if (deleteBtn) {
            const groupId = deleteBtn.dataset.groupId;
            console.log('Delete group clicked:', groupId); // Для отладки
            openDeleteGroupModal(groupId);
        }
    });

    // Обработчики для выбора цвета в модальных окнах
    setupColorSelection();
    
    console.log('Groups initialization completed'); // Для отладки
}

function setupColorSelection() {
    // Цвета для создания группы
    const colorOptions = document.querySelectorAll('#createGroupModal .color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedGroupColor = this.dataset.colorClass;
        });
    });

    // Цвета для редактирования группы
    const editColorOptions = document.querySelectorAll('#editGroupModal .color-option');
    editColorOptions.forEach(option => {
        option.addEventListener('click', function() {
            editColorOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedEditGroupColor = this.dataset.colorClass;
        });
    });
}

function openCreateGroupModal() {
    const modal = document.getElementById('createGroupModal');
    modal.style.display = 'flex';
    
    // Сброс формы
    document.getElementById('groupName').value = '';
    selectedGroupColor = 'badge-color-1';
    document.querySelectorAll('#createGroupModal .color-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    const defaultColorOption = document.querySelector('#createGroupModal .color-option[data-color-class="badge-color-1"]');
    if (defaultColorOption) {
        defaultColorOption.classList.add('selected');
    }
    
    // Загрузка списка участников
    loadCalendarMembers('groupMembersSelectList');
}

function openEditGroupModal(groupId) {
    console.log('Opening edit modal for group:', groupId); // Для отладки
    const modal = document.getElementById('editGroupModal');
    if (!modal) {
        console.error('Edit modal not found!');
        return;
    }
    modal.style.display = 'flex';
    
    // Загрузка данных группы
    loadGroupData(groupId);
}

function openDeleteGroupModal(groupId) {
    console.log('Opening delete modal for group:', groupId); // Для отладки
    const modal = document.getElementById('confirmDeleteGroupModal');
    if (!modal) {
        console.error('Delete modal not found!');
        return;
    }
    modal.style.display = 'flex';
    modal.dataset.groupId = groupId;
}

async function loadGroupData(groupId) {
    try {
        const response = await fetch(`/api/get_calendar_groups/${currentCalendarId}`);
        const data = await response.json();
        
        if (data.success) {
            const group = data.groups.find(g => g.id == groupId);
            if (group) {
                document.getElementById('editGroupId').value = group.id;
                document.getElementById('editGroupName').value = group.name;
                
                // Установка цвета
                selectedEditGroupColor = group.color;
                document.querySelectorAll('#editGroupModal .color-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                const colorOption = document.querySelector(`#editGroupModal .color-option[data-color-class="${group.color}"]`);
                if (colorOption) {
                    colorOption.classList.add('selected');
                }
                
                // Загрузка участников с предвыбранными
                loadCalendarMembers('editGroupMembersSelectList', group.members.map(m => m.id));
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки данных группы:', error);
        showNotification('Ошибка загрузки данных группы', 'error');
    }
}

async function loadCalendarMembers(containerId, selectedMemberIds = []) {
    try {
        // Получаем список всех участников календаря
        const membersResponse = await fetch(`/calendar/${currentCalendarId}/members`);
        const members = await membersResponse.json();
        
        // Получаем список всех групп календаря
        const groupsResponse = await fetch(`/api/get_calendar_groups/${currentCalendarId}`);
        const groupsData = await groupsResponse.json();
        
        if (members && members.length > 0) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            
            // Собираем ID всех пользователей, которые уже состоят в группах
            const usersInGroups = new Set();
            if (groupsData.success && groupsData.groups) {
                groupsData.groups.forEach(group => {
                    group.members.forEach(member => {
                        usersInGroups.add(member.id);
                    });
                });
            }
            
            // Фильтруем участников, исключая тех, кто уже в группах
            const availableMembers = members.filter(member => 
                !usersInGroups.has(member.id) || selectedMemberIds.includes(member.id)
            );
            
            if (availableMembers.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 1rem;">Нет доступных участников для добавления в группу</div>';
                return;
            }
            
            availableMembers.forEach(member => {
                const memberItem = document.createElement('div');
                memberItem.className = 'member-select-item';
                
                // Проверяем, состоит ли пользователь уже в группе
                const isInGroup = usersInGroups.has(member.id) && !selectedMemberIds.includes(member.id);
                
                if (isInGroup) {
                    memberItem.classList.add('disabled');
                }
                
                memberItem.innerHTML = `
                    <input type="checkbox" id="member_${member.id}" value="${member.id}" 
                           ${selectedMemberIds.includes(member.id) ? 'checked' : ''}
                           ${isInGroup ? 'disabled' : ''}>
                    <img src="/static/images/${member.avatar}" onerror="this.src='/static/images/default_avatar.svg'">
                    <span>${member.username}${isInGroup ? ' (уже в группе)' : ''}</span>
                `;
                
                // Если пользователь уже в группе, делаем элемент неактивным
                if (isInGroup) {
                    memberItem.style.cursor = 'not-allowed';
                } else {
                    memberItem.addEventListener('click', function(e) {
                        if (e.target.type !== 'checkbox') {
                            const checkbox = this.querySelector('input[type="checkbox"]');
                            checkbox.checked = !checkbox.checked;
                        }
                    });
                }
                
                container.appendChild(memberItem);
            });
        } else {
            const container = document.getElementById(containerId);
            container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 1rem;">Нет участников для добавления в группу</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки участников:', error);
        showNotification('Ошибка загрузки участников', 'error');
        
        const container = document.getElementById(containerId);
        container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 1rem;">Ошибка загрузки участников</div>';
    }
}

async function createGroup() {
    const name = document.getElementById('groupName').value.trim();
    if (!name) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    const selectedMembers = Array.from(document.querySelectorAll('#groupMembersSelectList input[type="checkbox"]:checked'))
        .map(checkbox => parseInt(checkbox.value));
    
    if (selectedMembers.length === 0) {
        showNotification('Выберите хотя бы одного участника для группы', 'error');
        return;
    }
    
    // Проверяем, что выбранные участники не состоят в других группах
    try {
        const groupsResponse = await fetch(`/api/get_calendar_groups/${currentCalendarId}`);
        const groupsData = await groupsResponse.json();
        
        if (groupsData.success && groupsData.groups) {
            const usersInGroups = new Set();
            groupsData.groups.forEach(group => {
                group.members.forEach(member => {
                    usersInGroups.add(member.id);
                });
            });
            
            const conflictingUsers = selectedMembers.filter(userId => usersInGroups.has(userId));
            if (conflictingUsers.length > 0) {
                showNotification('Некоторые выбранные участники уже состоят в других группах', 'error');
                return;
            }
        }
    } catch (error) {
        console.error('Ошибка проверки участников:', error);
        showNotification('Ошибка проверки участников', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/create_group', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                calendar_id: currentCalendarId,
                name: name,
                color: selectedGroupColor,
                user_ids: selectedMembers
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Группа успешно создана', 'success');
            closeModal('createGroupModal');
            location.reload(); // Перезагружаем страницу для обновления отображения
        } else {
            showNotification(data.error || 'Ошибка создания группы', 'error');
        }
    } catch (error) {
        console.error('Ошибка создания группы:', error);
        showNotification('Ошибка создания группы', 'error');
    }
}

async function updateGroup() {
    const groupId = document.getElementById('editGroupId').value;
    const name = document.getElementById('editGroupName').value.trim();
    
    if (!name) {
        showNotification('Введите название группы', 'error');
        return;
    }
    
    const selectedMembers = Array.from(document.querySelectorAll('#editGroupMembersSelectList input[type="checkbox"]:checked'))
        .map(checkbox => parseInt(checkbox.value));
    
    if (selectedMembers.length === 0) {
        showNotification('Выберите хотя бы одного участника для группы', 'error');
        return;
    }
    
    // Проверяем, что выбранные участники не состоят в других группах (кроме текущей)
    try {
        const groupsResponse = await fetch(`/api/get_calendar_groups/${currentCalendarId}`);
        const groupsData = await groupsResponse.json();
        
        if (groupsData.success && groupsData.groups) {
            const usersInOtherGroups = new Set();
            groupsData.groups.forEach(group => {
                if (group.id != groupId) { // Исключаем текущую группу
                    group.members.forEach(member => {
                        usersInOtherGroups.add(member.id);
                    });
                }
            });
            
            const conflictingUsers = selectedMembers.filter(userId => usersInOtherGroups.has(userId));
            if (conflictingUsers.length > 0) {
                showNotification('Некоторые выбранные участники уже состоят в других группах', 'error');
                return;
            }
        }
    } catch (error) {
        console.error('Ошибка проверки участников:', error);
        showNotification('Ошибка проверки участников', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/update_group/${groupId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                color: selectedEditGroupColor,
                user_ids: selectedMembers
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Группа успешно обновлена', 'success');
            closeModal('editGroupModal');
            location.reload(); // Перезагружаем страницу для обновления отображения
        } else {
            showNotification(data.error || 'Ошибка обновления группы', 'error');
        }
    } catch (error) {
        console.error('Ошибка обновления группы:', error);
        showNotification('Ошибка обновления группы', 'error');
    }
}

async function confirmDeleteGroup() {
    const modal = document.getElementById('confirmDeleteGroupModal');
    const groupId = modal.dataset.groupId;
    
    try {
        const response = await fetch(`/api/delete_group/${groupId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Группа успешно удалена', 'success');
            closeModal('confirmDeleteGroupModal');
            location.reload(); // Перезагружаем страницу для обновления отображения
        } else {
            showNotification(data.error || 'Ошибка удаления группы', 'error');
        }
    } catch (error) {
        console.error('Ошибка удаления группы:', error);
        showNotification('Ошибка удаления группы', 'error');
    }
}

function filterGroups() {
    const searchTerm = document.getElementById('searchGroupInput').value.toLowerCase();
    const groupItems = document.querySelectorAll('.group-item');
    
    groupItems.forEach(item => {
        const groupName = item.querySelector('.group-title').textContent.toLowerCase();
        if (groupName.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
}

function showNotification(message, type = 'info') {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Добавляем стили
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    // Цвета для разных типов уведомлений
    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#ef4444';
    } else {
        notification.style.backgroundColor = '#3b82f6';
    }
    
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Закрытие модальных окон при клике вне их
window.addEventListener('click', function(e) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Закрытие модальных окон по кнопке закрытия
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-close')) {
        const modal = e.target.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
});

// CSS анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

