// Глобальные переменные (currentCalendarId определена в view.js)
let selectedGroupColor = 'badge-color-1';
let selectedEditGroupColor = 'badge-color-1';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Groups.js: DOM loaded, initializing...'); // Для отладки
    
    // currentCalendarId уже определен в view.js
    console.log('Groups.js using Calendar ID:', currentCalendarId);
    
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

    // Обработчики для кнопок редактирования и удаления групп (делегирование событий)
    document.addEventListener('click', function(e) {
        // Проверяем, является ли кликнутый элемент кнопкой или его дочерним элементом
        const deleteBtn = e.target.closest('.delete-group-btn');
        const editBtn = e.target.closest('.edit-group-btn');
        const removeMemberBtn = e.target.closest('.btn-remove-member');
        
        if (editBtn) {
            const groupId = editBtn.dataset.groupId;
            console.log('Edit group clicked:', groupId); // Для отладки
            openEditGroupModal(groupId);
        } else if (deleteBtn) {
            const groupId = deleteBtn.dataset.groupId;
            console.log('Delete group clicked:', groupId); // Для отладки
            openDeleteGroupModal(groupId);
        } else if (removeMemberBtn) {
            // Обработка удаления участника из группы теперь происходит в view.js
            // Здесь ничего не делаем, чтобы избежать дублирования
            return;
        }
    });

    // Обработчики для выбора цвета в модальных окнах
    setupColorSelection();
    
    // Инициализируем объединенный DnD для групп и участников
    // Проверяем наличие таблицы календаря
    const calendarTable = document.querySelector('.calendar-table tbody');
    if (calendarTable) {
        console.log('📅 Calendar table found, initializing drag-and-drop...');
        setupUnifiedDragAndDrop();
    } else {
        console.log('⏳ Calendar table not found, will initialize drag-and-drop after table loads');
        // Попробуем инициализировать через небольшую задержку
        setTimeout(() => {
            const tbody = document.querySelector('.calendar-table tbody');
            if (tbody) {
                console.log('📅 Calendar table loaded, initializing drag-and-drop...');
                setupUnifiedDragAndDrop();
            } else {
                console.warn('❌ Calendar table still not found after delay');
            }
        }, 500);
    }
    
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
        toastManager.show('Ошибка загрузки данных группы', 'danger');
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
        toastManager.show('Ошибка загрузки участников', 'danger');
        
        const container = document.getElementById(containerId);
        container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 1rem;">Ошибка загрузки участников</div>';
    }
}

async function createGroup() {
    const name = document.getElementById('groupName').value.trim();
    if (!name) {
        toastManager.show('Введите название группы', 'danger');
        return;
    }
    
    const selectedMembers = Array.from(document.querySelectorAll('#groupMembersSelectList input[type="checkbox"]:checked'))
        .map(checkbox => parseInt(checkbox.value));
    
    if (selectedMembers.length === 0) {
        toastManager.show('Выберите хотя бы одного участника для группы', 'danger');
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
                toastManager.show('Некоторые выбранные участники уже состоят в других группах', 'danger');
                return;
            }
        }
    } catch (error) {
        console.error('Ошибка проверки участников:', error);
        toastManager.show('Ошибка проверки участников', 'danger');
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
            toastManager.show('Группа успешно создана', 'success');
            closeModal('createGroupModal');
            // Динамически добавляем новую группу в DOM
            addGroupToDOM(data.group);
            // Динамически обновляем календарь
            await updateCalendarAfterGroupChange();
        } else {
            toastManager.show(data.error || 'Ошибка создания группы', 'danger');
        }
    } catch (error) {
        console.error('Ошибка создания группы:', error);
        toastManager.show('Ошибка создания группы', 'danger');
    }
}

async function updateGroup() {
    const groupId = document.getElementById('editGroupId').value;
    const name = document.getElementById('editGroupName').value.trim();
    
    if (!name) {
        toastManager.show('Введите название группы', 'danger');
        return;
    }
    
    const selectedMembers = Array.from(document.querySelectorAll('#editGroupMembersSelectList input[type="checkbox"]:checked'))
        .map(checkbox => parseInt(checkbox.value));
    
    if (selectedMembers.length === 0) {
        toastManager.show('Выберите хотя бы одного участника для группы', 'danger');
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
                toastManager.show('Некоторые выбранные участники уже состоят в других группах', 'danger');
                return;
            }
        }
    } catch (error) {
        console.error('Ошибка проверки участников:', error);
        toastManager.show('Ошибка проверки участников', 'danger');
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
            toastManager.show('Группа успешно обновлена', 'success');
            closeModal('editGroupModal');
            // Динамически обновляем группу в DOM
            updateGroupInDOM(data.group);
            // Динамически обновляем календарь
            await updateCalendarAfterGroupChange();
        } else {
            toastManager.show(data.error || 'Ошибка обновления группы', 'danger');
        }
    } catch (error) {
        console.error('Ошибка обновления группы:', error);
        toastManager.show('Ошибка обновления группы', 'danger');
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
            toastManager.show('Группа успешно удалена', 'success');
            closeModal('confirmDeleteGroupModal');
            // Динамически удаляем группу из DOM
            removeGroupFromDOM(groupId);
            // Динамически обновляем календарь
            await updateCalendarAfterGroupChange();
        } else {
            toastManager.show(data.error || 'Ошибка удаления группы', 'danger');
        }
    } catch (error) {
        console.error('Ошибка удаления группы:', error);
        toastManager.show('Ошибка удаления группы', 'danger');
    }
}

async function removeMemberFromGroup(groupId, userId) {
    try {
        const response = await fetch(`/api/remove_member_from_group/${groupId}/${userId}`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            toastManager.show(data.message, 'success');
            
            // Удаляем участника из DOM таблицы календаря
            const userRow = document.querySelector(`.user-row[data-user-id="${userId}"]`);
            if (userRow) {
                userRow.remove();
            }
            
            // Обновляем количество участников в группе
            const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
            if (groupElement) {
                const membersCountElement = groupElement.querySelector('.group-members-count');
                if (membersCountElement) {
                    const currentCount = parseInt(membersCountElement.textContent.match(/\d+/)[0]);
                    const newCount = currentCount - 1;
                    
                    if (newCount === 0) {
                        // Если у группы не осталось участников, удаляем её
                        removeGroupFromDOM(groupId);
                    } else {
                        membersCountElement.textContent = `${newCount} участников`;
                    }
                }
            }
            
            // Обновляем модальное окно добавления участника
            updateAddMembersModal();
            
            // Динамически обновляем календарь
            await updateCalendarAfterGroupChange();
        } else {
            toastManager.show(data.error || 'Ошибка удаления участника из группы', 'danger');
        }
    } catch (error) {
        console.error('Ошибка удаления участника из группы:', error);
        toastManager.show('Ошибка удаления участника из группы', 'danger');
    }
}

// Функция для создания DOM-элемента группы
function createGroupElement(group) {
    const groupElement = document.createElement('div');
    groupElement.className = 'group-item';
    groupElement.dataset.groupId = group.id;
    
    groupElement.innerHTML = `
        <div class="group-header">
            <div class="group-color-indicator ${group.color}"></div>
            <div class="group-info">
                <div class="group-title">${group.name}</div>
                <div class="group-members-count">${group.members.length} участников</div>
            </div>
        </div>
        <div class="group-actions">
            <button class="delete-group-btn" data-group-id="${group.id}">
                <i class="bi bi-trash"></i>
            </button>
            <button class="edit-group-btn" data-group-id="${group.id}">
                <i class="bi bi-pencil"></i>
            </button>
        </div>
    `;
    
    return groupElement;
}

// Функция для динамического добавления группы в DOM
function addGroupToDOM(group) {
    try {
        const groupList = document.getElementById('groupList');
        if (!groupList) return;
        
        // Скрываем сообщение "нет групп" если оно есть
        const noGroupsElement = groupList.querySelector('.no-groups');
        if (noGroupsElement) {
            noGroupsElement.remove();
        }
        
        const groupElement = document.createElement('div');
        groupElement.className = 'group-item';
        groupElement.dataset.groupId = group.id;
        
        groupElement.innerHTML = `
            <div class="group-header">
                <div class="group-color-indicator ${group.color}"></div>
                <div class="group-info">
                    <div class="group-title">${group.name}</div>
                    <div class="group-members-count">${group.members.length} участников</div>
                </div>
            </div>
            <div class="group-actions">
                <button class="delete-group-btn" data-group-id="${group.id}">
                    <i class="bi bi-trash"></i>
                </button>
                <button class="edit-group-btn" data-group-id="${group.id}">
                    <i class="bi bi-pencil"></i>
                </button>
            </div>
        `;
        
        // Добавляем в начало списка (новые группы выше по позиции)
        groupList.insertBefore(groupElement, groupList.firstChild);
        
        // Инициализируем DnD для заголовков групп
        setupGroupDragAndDrop();
        
        // Инициализируем DnD для участников (если функция доступна)
        if (typeof setupDraggableRows === 'function') {
            setupDraggableRows();
        }
        
        // Обновляем счетчик групп
        updateGroupsCount();
        
    } catch (error) {
        console.error('Ошибка добавления группы в DOM:', error);
    }
}

// Функция для динамического обновления группы в DOM
function updateGroupInDOM(group) {
    try {
        const groupElement = document.querySelector(`[data-group-id="${group.id}"]`);
        if (!groupElement) return;
        
        // Обновляем содержимое группы
        groupElement.querySelector('.group-title').textContent = group.name;
        groupElement.querySelector('.group-members-count').textContent = `${group.members.length} участников`;
        groupElement.querySelector('.group-color-indicator').className = `group-color-indicator ${group.color}`;
        
        // Если у группы не осталось участников, удаляем её
        if (group.members.length === 0) {
            removeGroupFromDOM(group.id);
        }
        
    } catch (error) {
        console.error('Ошибка обновления группы в DOM:', error);
    }
}

// Функция для динамического удаления группы из DOM
function removeGroupFromDOM(groupId) {
    const groupElement = document.querySelector(`[data-group-id="${groupId}"]`);
    if (groupElement) {
        groupElement.remove();
        
        // Проверяем, остались ли группы
        const groupList = document.getElementById('groupList');
        if (groupList && groupList.children.length === 0) {
            // Если групп не осталось, показываем сообщение "нет групп"
            const noGroupsElement = document.createElement('div');
            noGroupsElement.className = 'no-groups';
            noGroupsElement.innerHTML = `
                <i class="bi bi-people"></i>
                <p>Нет созданных групп</p>
            `;
            groupList.appendChild(noGroupsElement);
        }
        
        // Обновляем счетчик групп
        updateGroupsCount();
    }
}

// Функция для обновления счетчика групп
function updateGroupsCount() {
    const groupList = document.getElementById('groupList');
    if (groupList) {
        const groupCount = groupList.children.length;
        // Если есть элемент с количеством групп в заголовке, обновляем его
        const countElement = document.querySelector('.groups-count');
        if (countElement) {
            countElement.textContent = groupCount;
        }
    }
}

// Объединенная инициализация Drag&Drop для групп и участников
function setupUnifiedDragAndDrop() {
    try {
        console.log('=== setupUnifiedDragAndDrop called ===');
        
        const tbody = document.querySelector('.calendar-table tbody');
        if (!tbody) {
            console.log('Table body not found');
            return;
        }

        // Уничтожаем все предыдущие инстансы
        if (tbody.groupSortableInstance) {
            tbody.groupSortableInstance.destroy();
            tbody.groupSortableInstance = null;
        }
        if (tbody.userSortableInstance) {
            tbody.userSortableInstance.destroy();
            tbody.userSortableInstance = null;
        }

        const ownerRow = tbody.querySelector('.user-row.owner');
        const ungroupedHeader = tbody.querySelector('tr.group-header-row[data-ungrouped="true"]');
        const isOwner = isCalendarOwner();

        let draggingType = null; // 'group' или 'user'
        let draggingGroupId = null;
        let draggingMemberRows = [];

        console.log('🔧 Creating unified sortable instance...');
        
        // Отладка: проверяем какие элементы найдены селекторами
        const draggableSelector = isOwner ? 
            'tr.group-header-row[data-group-id], tr.user-row:not(.owner)' : 
            'tr.user-row:not(.owner)';
        const handleSelector = '.group-header-cell, .user-cell';
        
        console.log('🔍 Draggable selector:', draggableSelector);
        console.log('🔍 Handle selector:', handleSelector);
        
        const draggableElements = tbody.querySelectorAll(draggableSelector);
        const handleElements = tbody.querySelectorAll(handleSelector);
        
        console.log('🔍 Found draggable elements:', draggableElements.length);
        draggableElements.forEach((el, i) => {
            console.log(`   ${i+1}. ${el.className} - dataset:`, el.dataset);
        });
        
        console.log('🔍 Found handle elements:', handleElements.length);
        handleElements.forEach((el, i) => {
            console.log(`   ${i+1}. ${el.className} - parent:`, el.parentElement.className);
        });
        
        // Добавляем отладку событий мыши на handle элементы
        handleElements.forEach(el => {
            el.addEventListener('mousedown', (e) => {
                console.log('🖱️ mousedown on handle:', el.className, 'parent:', el.parentElement.className);
            });
            el.addEventListener('dragstart', (e) => {
                console.log('🚀 dragstart on handle:', el.className);
            });
        });

        tbody.unifiedSortableInstance = Sortable.create(tbody, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            
            // Определяем селекторы для перетаскиваемых элементов
            draggable: draggableSelector,

            // Используем универсальный handle - и для групп и для пользователей
            handle: handleSelector,

            // Определяем тип элемента при выборе
            onChoose: function(evt) {
                console.log('🎯 onChoose triggered for:', evt.item.className, 'dataset:', evt.item.dataset);
                console.log('🎯 Event details:', {
                    target: evt.target,
                    originalEvent: evt.originalEvent,
                    item: evt.item,
                    from: evt.from
                });
                
                if (evt.item.classList.contains('group-header-row')) {
                    draggingType = 'group';
                    draggingGroupId = evt.item.dataset.groupId;
                    draggingMemberRows = Array.from(tbody.querySelectorAll(`.user-row[data-group-id="${draggingGroupId}"]`));
                    console.log('🔄 Dragging group:', draggingGroupId, 'with', draggingMemberRows.length, 'members');
                } else if (evt.item.classList.contains('user-row')) {
                    draggingType = 'user';
                    console.log('🔄 Dragging user:', evt.item.dataset.userId);
                } else {
                    console.warn('⚠️ Unknown dragging element:', evt.item.className);
                }
            },

            onStart: function(evt) {
                console.log('🚀 onStart - draggingType:', draggingType, 'element:', evt.item.className);
            },

            onMove: function(evt) {
                const draggedItem = evt.dragged;
                const relatedItem = evt.related;

                // Общие ограничения
                if (ownerRow) {
                    const ownerIndex = Array.from(tbody.children).indexOf(ownerRow);
                    const targetIndex = Array.from(tbody.children).indexOf(relatedItem);
                    if (targetIndex !== -1 && targetIndex <= ownerIndex) {
                        return false;
                    }
                }

                if (draggingType === 'group') {
                    // Логика для перетаскивания групп
                    if (!isOwner) {
                        return false;
                    }

                    // Ранее мы запрещали таргет на строки участников, что приводило к откату
                    // Теперь разрешаем таргет и даём Sortable самостоятельно вычислить позицию
                    // между заголовками групп. Порядок групп мы всё равно собираем по заголовкам.

                    // Запрещаем опускать ниже заголовка "Без группы"
                    if (ungroupedHeader) {
                        const ungroupedIndex = Array.from(tbody.children).indexOf(ungroupedHeader);
                        const targetIndex = Array.from(tbody.children).indexOf(relatedItem);
                        if (targetIndex !== -1 && targetIndex > ungroupedIndex) {
                            return false;
                        }
                    }
                } else if (draggingType === 'user') {
                    // Логика для перетаскивания участников
                    
                    // Запрещаем перемещение на заголовки групп
                    if (relatedItem && relatedItem.classList.contains('group-header-row')) {
                        return false;
                    }

                    // Проверяем, что участник перемещается только в пределах своей группы
                    if (relatedItem && relatedItem.classList.contains('user-row')) {
                        const draggedGroupId = draggedItem.dataset.groupId || 'ungrouped';
                        const targetGroupId = relatedItem.dataset.groupId || 'ungrouped';

                        if (draggedGroupId !== targetGroupId) {
                            return false;
                        }
                    }
                }

                return true;
            },

            onEnd: async function(evt) {
                console.log('🏁 onEnd triggered!');
                console.log('   - draggingType:', draggingType);
                console.log('   - oldIndex:', evt.oldIndex, 'newIndex:', evt.newIndex);
                console.log('   - item:', evt.item.className);
                console.log('   - item dataset:', evt.item.dataset);

                if (draggingType === 'group') {
                    console.log('📦 Calling handleGroupDrop...');
                    await handleGroupDrop(evt);
                } else if (draggingType === 'user') {
                    if (evt.oldIndex === evt.newIndex) {
                        console.log('⏭️ No position change for user, skipping');
                        return;
                    }
                    console.log('👤 Calling handleUserDrop...');
                    await handleUserDrop(evt);
                } else {
                    console.warn('❓ Unknown draggingType:', draggingType);
                }

                // Сброс состояния
                draggingType = null;
                draggingGroupId = null;
                draggingMemberRows = [];
            }
        });
        
        console.log('✅ Unified sortable instance created successfully');
    } catch (e) {
        console.error('Не удалось инициализировать объединенный DnD:', e);
    }
}

// Обработка завершения перетаскивания группы
async function handleGroupDrop(evt) {
    try {
        console.log('=== GROUP DROP DEBUG ===');
        console.log('evt.oldIndex:', evt.oldIndex, 'evt.newIndex:', evt.newIndex);

        // Получаем tbody заранее
        const tbody = document.querySelector('.calendar-table tbody');

        // Определяем заголовок группы и её id из события
        const headerAfterDrop = evt.item;
        const groupId = headerAfterDrop?.dataset?.groupId;
        if (!groupId) {
            console.error('No groupId found on dropped header!');
            return;
        }
        console.log('groupId (from evt.item):', groupId);

        // Вычисляем строки участников этой группы на момент drop
        const memberRows = Array.from(tbody.querySelectorAll(`.user-row[data-group-id="${groupId}"]`));
        console.log('memberRows count (computed):', memberRows.length);

        // Переносим все строки участников за новым положением заголовка
        const referenceNode = headerAfterDrop.nextSibling;
        console.log('Moving', memberRows.length, 'member rows after header');

        memberRows.forEach((row, index) => {
            console.log(`Moving member row ${index}:`, row.dataset.userId);
            tbody.insertBefore(row, referenceNode);
        });

        // Собираем новый порядок заголовков групп
        const ungroupedHeader = tbody.querySelector('tr.group-header-row[data-ungrouped="true"]');
        const order = [];
        const headerRows = Array.from(tbody.querySelectorAll('tr.group-header-row[data-group-id]'));
        
        console.log('Found header rows:', headerRows.length);
        console.log('Ungrouped header exists:', !!ungroupedHeader);
        
        for (const hr of headerRows) {
            if (ungroupedHeader && hr === ungroupedHeader) {
                console.log('Stopping at ungrouped header');
                break;
            }
            const gid = parseInt(hr.dataset.groupId);
            if (!isNaN(gid)) {
                order.push(gid);
                console.log('Added group to order:', gid);
            }
        }

        console.log('Final group order:', order);

        // Сохраняем порядок на сервере
        console.log('Sending request to:', `/api/update_group_positions/${currentCalendarId}`);
        console.log('Request body:', { order });
        
        const resp = await fetch(`/api/update_group_positions/${currentCalendarId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order })
        });
        
        console.log('Response status:', resp.status);
        
        if (!resp.ok) {
            console.error('Server responded with error:', resp.status, resp.statusText);
            await updateCalendarAfterGroupChange();
            return;
        }
        
        const data = await resp.json();
        console.log('Server response:', data);
        
        if (!data.success) {
            console.error('Server rejected group position update:', data.error);
            await updateCalendarAfterGroupChange();
            return;
        }
        
        console.log('✅ Group positions saved successfully!');
        // Не вызываем updateCalendarAfterGroupChange() чтобы не перерисовывать таблицу
        console.log('=== GROUP DROP COMPLETE ===');
    } catch (e) {
        console.error('❌ Error in handleGroupDrop:', e);
        await updateCalendarAfterGroupChange();
    }
}

// Обработка завершения перетаскивания участника
async function handleUserDrop(evt) {
    try {
        const rows = document.querySelectorAll('.user-row:not(.owner)');
        if (rows.length === 0) return;

        const positions = {};
        const calendarId = document.body.dataset.calendarId || currentCalendarId;

        rows.forEach((row, index) => {
            const userId = row.dataset.userId;
            if (userId) positions[userId] = index + 1;
        });

        const response = await fetch(`/calendar/${calendarId}/update-positions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ positions: positions })
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 403) {
                throw new Error('У вас нет прав на изменение порядка участников!');
            }
            throw new Error(errorData.error || 'Неизвестная ошибка сервера');
        }

        if (typeof toastManager !== 'undefined') {
            toastManager.show('Порядок участников сохранён', 'success');
        }
    } catch (error) {
        console.error('Ошибка сохранения порядка участников:', error);
        if (typeof toastManager !== 'undefined') {
            toastManager.show(`Не удалось сохранить порядок: ${error.message}`, 'danger');
        }
        // Восстанавливаем предыдущий порядок
        await updateCalendarAfterGroupChange();
    }
}

// Функция для динамического обновления календаря после изменения групп
async function updateCalendarAfterGroupChange() {
    try {
        // Получаем обновленные данные о группах
        const groupsResponse = await fetch(`/api/get_calendar_groups/${currentCalendarId}`);
        const groupsData = await groupsResponse.json();
        
        if (groupsData.success) {
            // Получаем список всех участников календаря
            const membersResponse = await fetch(`/calendar/${currentCalendarId}/members`);
            const members = await membersResponse.json();
            console.log('=== DIAG: updateCalendarAfterGroupChange ===');
            console.log('Groups (raw from API):', groupsData.groups.map(g => ({ id: g.id, name: g.name, pos: g.position, members: g.members.map(m=>m.id) })));
            console.log('Members (raw from API):', members.map(m => ({ id: m.id, username: m.username })));
            
            // Обновляем календарь динамически
            await rebuildCalendarTableFromData(groupsData.groups, members);
            
            // Обновляем модальное окно добавления участника
            await updateAddMembersModal();

            // Единоразово обновляем сайдбар групп после полной синхронизации
            await updateGroupsSidebar();
        }
    } catch (error) {
        console.error('Ошибка обновления календаря:', error);
    }
}

// Функция для динамического обновления таблицы календаря (локальная, чтобы не пересекаться с view.js)
async function rebuildCalendarTableFromData(groups, members) {
    try {
        // Получаем смены для отображения
        const shiftsResponse = await fetch(`/calendar/${currentCalendarId}/shifts`);
        const shifts = await shiftsResponse.json();
        console.log('=== DIAG: updateCalendarTable input ===');
        console.log('Groups count:', groups.length);
        console.log('Groups summary:', groups.map(g => ({ id: g.id, name: g.name, pos: g.position, membersCount: g.members.length })));
        console.log('Members count:', members.length);
        
        // Детальная диагностика позиций групп
        console.log('=== DETAILED POSITION DEBUG ===');
        groups.forEach(g => {
            console.log(`Group "${g.name}": id=${g.id}, position=${g.position} (type: ${typeof g.position})`);
        });

        // Создаем карту групп для быстрого поиска
        const userGroups = new Map();
        groups.forEach(group => {
            group.members.forEach(member => {
                if (!userGroups.has(member.id)) {
                    userGroups.set(member.id, []);
                }
                userGroups.get(member.id).push(group);
            });
        });
        console.log('User -> Groups map (ids):', Array.from(userGroups.entries()).map(([uid, gs]) => [uid, gs.map(g => g.id)]));
        
        // Группируем участников
        const groupedMembers = new Map();
        
        // Добавляем участников в группы
        members.forEach(member => {
            // Получаем ID владельца календаря
            const ownerElement = document.querySelector('.user-row.owner');
            const ownerId = ownerElement ? parseInt(ownerElement.dataset.userId) : null;
            
            if (member.id !== ownerId) { // Исключаем создателя календаря
                if (userGroups.has(member.id)) {
                    // Участник в группе
                    userGroups.get(member.id).forEach(group => {
                        if (!groupedMembers.has(group.id)) {
                            groupedMembers.set(group.id, { group: group, members: [] });
                        }
                        groupedMembers.get(group.id).members.push(member);
                    });
                } else {
                    // Участник без группы
                    if (!groupedMembers.has('ungrouped')) {
                        groupedMembers.set('ungrouped', { group: null, members: [] });
                    }
                    groupedMembers.get('ungrouped').members.push(member);
                }
            }
        });
        // Диагностика сгруппированных данных
        const groupedDiag = Array.from(groupedMembers.entries()).map(([gid, data]) => ({
            groupId: gid,
            groupName: gid === 'ungrouped' ? 'Без группы' : data.group?.name,
            position: gid === 'ungrouped' ? null : data.group?.position,
            members: data.members.map(m => m.id),
            membersCount: data.members.length
        }));
        console.log('GroupedMembers (pre-sort):', groupedDiag);

        // Сортируем группы по позиции перед передачей в updateCalendarTableRows
        const sortedGroupedMembers = new Map();
        
        // Сначала добавляем все группы (кроме ungrouped) по позиции
        const groupsOnly = new Map();
        groupedMembers.forEach((groupData, groupId) => {
            if (groupId !== 'ungrouped' && groupData.members.length > 0) {
                groupsOnly.set(groupId, groupData);
            }
        });
        
        // Сортируем группы по позиции в убывающем порядке (новые выше - большая позиция сверху)
        const sortedGroupIds = Array.from(groupsOnly.keys()).sort((a, b) => {
            const groupA = groupsOnly.get(a);
            const groupB = groupsOnly.get(b);
            const byPos = groupB.group.position - groupA.group.position;
            if (byPos !== 0) return byPos;
            // стабильная вторичная сортировка по id: новые выше
            return groupB.group.id - groupA.group.id;
        });
        console.log('Sorted group ids by position (desc):', sortedGroupIds);
        
        // Детальная диагностика сортировки
        console.log('=== SORTING DEBUG ===');
        sortedGroupIds.forEach(groupId => {
            const groupData = groupsOnly.get(groupId);
            console.log(`After sort: Group "${groupData.group.name}" (id=${groupData.group.id}, pos=${groupData.group.position})`);
        });
        
        // Добавляем отсортированные группы
        sortedGroupIds.forEach(groupId => {
            const groupData = groupsOnly.get(groupId);
            sortedGroupedMembers.set(groupId, groupData);
        });
        
        // Получаем данные "Без группы" один раз
        const ungroupedData = groupedMembers.get('ungrouped');
        console.log('Ungrouped members count:', ungroupedData ? ungroupedData.members.length : 0);

        // ВСЕГДА в самом конце добавляем участников без группы (только если есть участники)
        if (ungroupedData && ungroupedData.members.length > 0) {
            sortedGroupedMembers.set('ungrouped', ungroupedData);
        }
        
        // Дополнительная проверка: убеждаемся, что ungrouped всегда последний
        // Используем массив для гарантированного порядка
        const finalOrder = [];
        
        // Сначала добавляем все группы (кроме ungrouped) в правильном порядке
        sortedGroupedMembers.forEach((groupData, groupId) => {
            if (groupId !== 'ungrouped') {
                finalOrder.push({ groupId, groupData });
            }
        });
        
        // В самом конце добавляем ungrouped
        if (ungroupedData && ungroupedData.members.length > 0) {
            finalOrder.push({ groupId: 'ungrouped', groupData: ungroupedData });
        }
        
        console.log('Финальный порядок (массив):', finalOrder.map(item => item.groupId));
        
        // Создаем новый Map с правильным порядком
        const finalSortedGroupedMembers = new Map();
        finalOrder.forEach(item => {
            finalSortedGroupedMembers.set(item.groupId, item.groupData);
        });
        
        console.log('Финальные отсортированные groupedMembers:', finalSortedGroupedMembers);
        console.log('Проверка порядка в Map:', Array.from(finalSortedGroupedMembers.keys()));
        
        // Обновляем таблицу календаря
        updateCalendarTableRows(finalSortedGroupedMembers, shifts);
        
    } catch (error) {
        console.error('Ошибка обновления таблицы календаря:', error);
    }
}

// Функция для обновления строк таблицы календаря
function updateCalendarTableRows(groupedMembers, shifts) {
    console.log('=== updateCalendarTableRows ===');
    console.log('Входные данные groupedMembers:', groupedMembers);
    
    const tbody = document.querySelector('.calendar-table tbody');
    if (!tbody) return;
    
    // Удаляем все строки кроме первой (создатель календаря)
    const ownerRow = tbody.querySelector('.user-row.owner');
    tbody.innerHTML = '';
    if (ownerRow) {
        tbody.appendChild(ownerRow);
    }
    
    // Данные уже отсортированы в updateCalendarTable, просто отображаем их
    console.log('Отображение групп в порядке:', Array.from(groupedMembers.keys()));
    
    // Используем массив для гарантированного порядка отображения
    const displayOrder = Array.from(groupedMembers.keys());
    console.log('Порядок отображения (массив):', displayOrder);
    
    displayOrder.forEach(groupId => {
        const groupData = groupedMembers.get(groupId);
        
        // Пропускаем пустые группы
        if (groupData.members.length === 0) {
            console.log(`Пропускаем пустую группу: ${groupId}`);
            return;
        }
        
        if (groupId === 'ungrouped') {
            console.log('Добавляем заголовок: Без группы');
            // Заголовок для участников без группы
            addGroupHeaderRow(tbody, null, 'Без группы', groupData.members.length);
        } else {
            console.log(`Добавляем группу: ${groupData.group.name} (позиция: ${groupData.group.position}), участников: ${groupData.members.length}`);
            // Заголовок группы
            addGroupHeaderRow(tbody, groupData.group, groupData.group.name, groupData.members.length);
        }
        
        // Добавляем строки участников
        groupData.members.forEach(member => {
            addUserRow(tbody, member, groupData.group, shifts);
        });
    });
    
    // Инициализируем объединенный DnD для групп и участников
    setupUnifiedDragAndDrop();
    
    // Настраиваем обработчики ячеек календаря (если функция доступна)
    console.log('Checking setupCalendarCellHandlers availability:', typeof window.setupCalendarCellHandlers);
    if (typeof window.setupCalendarCellHandlers === 'function') {
        console.log('Calling setupCalendarCellHandlers...');
        window.setupCalendarCellHandlers();
    } else {
        console.error('setupCalendarCellHandlers not available!');
    }
    
    // Настраиваем обработчики смен (если функция доступна)
    console.log('Checking setupShiftHandlers availability:', typeof window.setupShiftHandlers);
    if (typeof window.setupShiftHandlers === 'function') {
        console.log('Calling setupShiftHandlers...');
        window.setupShiftHandlers();
    } else {
        console.error('setupShiftHandlers not available!');
    }
}

// Функция для добавления заголовка группы
function addGroupHeaderRow(tbody, group, title, memberCount = null) {
    const headerRow = document.createElement('tr');
    headerRow.className = 'group-header-row';
    if (group && group.id) {
        headerRow.dataset.groupId = group.id;
    } else {
        headerRow.dataset.ungrouped = 'true';
    }
    
    const headerCell = document.createElement('td');
    headerCell.className = 'group-header-cell';
    headerCell.colSpan = getDaysInMonthCount() + 1;
    
    const headerContent = document.createElement('div');
    headerContent.className = 'group-header-content';
    
    if (group) {
        const colorIndicator = document.createElement('div');
        colorIndicator.className = `group-color-indicator ${group.color}`;
        headerContent.appendChild(colorIndicator);
    }
    
    const groupName = document.createElement('span');
    groupName.className = 'group-name';
    groupName.textContent = title;
    headerContent.appendChild(groupName);

    // По просьбе пользователя скрываем визуальный счетчик участников в заголовке группы
    
    headerCell.appendChild(headerContent);
    headerRow.appendChild(headerCell);
    tbody.appendChild(headerRow);
}

// Функция для добавления строки участника
function addUserRow(tbody, member, group, shifts) {
    const userRow = document.createElement('tr');
    userRow.className = 'user-row';
    userRow.dataset.userId = member.id;
    if (group) {
        userRow.dataset.groupId = group.id;
    }
    
    // Ячейка с информацией об участнике
    const userCell = document.createElement('td');
    userCell.className = 'user-cell';
    
    const userCellContent = document.createElement('div');
    userCellContent.className = 'user-cell-content';
    
    const userAvatar = document.createElement('img');
    userAvatar.src = `/static/images/${member.avatar}`;
    userAvatar.onerror = "this.src='/static/images/default_avatar.svg'";
    userCellContent.appendChild(userAvatar);
    
    const userName = document.createElement('span');
    userName.textContent = member.username + (member.id === getCurrentUserId() ? ' (Вы)' : '');
    userCellContent.appendChild(userName);
    
    userCell.appendChild(userCellContent);
    
    // Кнопка удаления участника (если пользователь - владелец календаря)
    if (isCalendarOwner() && member.id !== getCurrentUserId()) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove-member';
        removeBtn.dataset.userId = member.id;
        removeBtn.title = 'Удалить участника';
        removeBtn.innerHTML = '<i class="bi bi-x"></i>';
        userCell.appendChild(removeBtn);
    }
    
    userRow.appendChild(userCell);
    
    // Добавляем ячейки для каждого дня месяца
    const daysInMonth = getDaysInMonthCount();
    for (let i = 0; i < daysInMonth; i++) {
        const dayCell = document.createElement('td');
        dayCell.className = 'day-cell';
        dayCell.dataset.date = getDateForDayIndex(i);
        dayCell.dataset.userId = member.id;
        
        // Добавляем смены для этого дня и участника
        const dayShifts = shifts.filter(shift => 
            shift.user_id === member.id && shift.date === getDateForDayIndex(i)
        );
        
        dayShifts.forEach(shift => {
            const shiftBadge = createShiftBadge(shift);
            dayCell.appendChild(shiftBadge);
        });
        
        userRow.appendChild(dayCell);
    }
    
    tbody.appendChild(userRow);
}

// Функция для создания бейджа смены
function createShiftBadge(shift) {
    const shiftBadge = document.createElement('div');
    shiftBadge.className = `shift-badge ${shift.color_class}`;
    shiftBadge.dataset.shiftId = shift.id;
    shiftBadge.title = shift.title + (shift.show_time ? ` (${shift.start_time}-${shift.end_time})` : '');
    
    const title = document.createElement('span');
    title.textContent = shift.title.length > 8 ? shift.title.substring(0, 8) + '...' : shift.title;
    shiftBadge.appendChild(title);
    
    if (shift.show_time) {
        const timeBreak = document.createElement('br');
        shiftBadge.appendChild(timeBreak);
        
        const time = document.createElement('span');
        time.textContent = `${shift.start_time} - ${shift.end_time}`;
        shiftBadge.appendChild(time);
    }
    
    // Кнопка удаления смены (если пользователь - владелец календаря)
    if (isCalendarOwner()) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-shift-btn';
        removeBtn.dataset.shiftId = shift.id;
        removeBtn.innerHTML = '&times;';
        shiftBadge.appendChild(removeBtn);
    }
    
    return shiftBadge;
}

// Вспомогательные функции
function getDaysInMonthCount() {
    const headerCells = document.querySelectorAll('.calendar-table thead th');
    return headerCells.length - 1; // Минус колонка "Коллега"
}

function getDateForDayIndex(dayIndex) {
    // Получаем дату из заголовка таблицы
    const headerRow = document.querySelector('.calendar-table thead tr');
    const dayHeader = headerRow.children[dayIndex + 1]; // +1 для пропуска колонки "Коллега"
    if (dayHeader) {
        // Извлекаем дату из атрибута или текста
        const dateAttr = dayHeader.dataset.date;
        if (dateAttr) {
            return dateAttr;
        }
        // Если атрибут не найден, пытаемся извлечь дату из текста заголовка
        const dayText = dayHeader.textContent.trim();
        const dayMatch = dayText.match(/(\d+)/);
        if (dayMatch) {
            const day = parseInt(dayMatch[1]);
            // Получаем текущий месяц и год
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }
    return '';
}

function getCurrentUserId() {
    // Получаем ID текущего пользователя из данных страницы
    // Ищем элемент с информацией о текущем пользователе
    const currentUserElement = document.querySelector('.user-row[data-user-id]');
    if (currentUserElement) {
        return parseInt(currentUserElement.dataset.userId);
    }
    
    // Альтернативный способ - ищем по классу "owner"
    const ownerElement = document.querySelector('.user-row.owner');
    if (ownerElement) {
        return parseInt(ownerElement.dataset.userId);
    }
    
    return null;
}

function isCalendarOwner() {
    // Проверяем, является ли текущий пользователь владельцем календаря
    const ownerElement = document.querySelector('.user-row.owner');
    if (ownerElement) {
        const ownerId = parseInt(ownerElement.dataset.userId);
        const currentUserId = getCurrentUserId();
        return ownerId === currentUserId;
    }
    return false;
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

// Функция для обновления модального окна добавления участника
async function updateAddMembersModal() {
    try {
        // Получаем обновленный список участников календаря
        const membersResponse = await fetch(`/calendar/${currentCalendarId}/members`);
        const members = await membersResponse.json();
        
        // Получаем обновленный список групп
        const groupsResponse = await fetch(`/api/get_calendar_groups/${currentCalendarId}`);
        const groupsData = await groupsResponse.json();
        
        if (members && members.length > 0) {
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
                !usersInGroups.has(member.id)
            );
            
            // Обновляем список в модальном окне добавления участника
            const addMembersModal = document.getElementById('addMembersModal');
            if (addMembersModal) {
                const friendsSelectList = addMembersModal.querySelector('#friendsSelectList');
                if (friendsSelectList) {
                    friendsSelectList.innerHTML = '';
                    
                    if (availableMembers.length === 0) {
                        friendsSelectList.innerHTML = '<div style="text-align: center; color: #64748b; padding: 1rem;">Нет доступных участников для добавления</div>';
                        return;
                    }
                    
                    availableMembers.forEach(member => {
                        const memberItem = document.createElement('div');
                        memberItem.className = 'member-select-item';
                        memberItem.innerHTML = `
                            <input type="checkbox" id="member_${member.id}" value="${member.id}">
                            <img src="/static/images/${member.avatar}" onerror="this.src='/static/images/default_avatar.svg'">
                            <span>${member.username}</span>
                        `;
                        
                        memberItem.addEventListener('click', function(e) {
                            if (e.target.type !== 'checkbox') {
                                const checkbox = this.querySelector('input[type="checkbox"]');
                                checkbox.checked = !checkbox.checked;
                            }
                        });
                        
                        friendsSelectList.appendChild(memberItem);
                    });
                }
            }
        }
    } catch (error) {
        console.error('Ошибка обновления модального окна добавления участника:', error);
    }
}

// Функция для обновления списка групп в сайдбаре
async function updateGroupsSidebar() {
    try {
        const groupsResponse = await fetch(`/api/get_calendar_groups/${currentCalendarId}`);
        const groupsData = await groupsResponse.json();
        
        if (groupsData.success) {
            const groupList = document.getElementById('groupList');
            if (!groupList) return;
            
            // Очищаем список групп
            groupList.innerHTML = '';
            
            if (groupsData.groups.length === 0) {
                // Если групп не осталось, показываем сообщение "нет групп"
                const noGroupsElement = document.createElement('div');
                noGroupsElement.className = 'no-groups';
                noGroupsElement.innerHTML = `
                    <i class="bi bi-people"></i>
                    <p>Нет созданных групп</p>
                `;
                groupList.appendChild(noGroupsElement);
            } else {
                // Сортируем группы по позиции в убывающем порядке (новые выше - большая позиция сверху)
                console.log('=== SIDEBAR SORTING DEBUG ===');
                groupsData.groups.forEach(g => {
                    console.log(`Sidebar Group "${g.name}": id=${g.id}, position=${g.position} (type: ${typeof g.position})`);
                });
                
                const sortedGroups = groupsData.groups.sort((a, b) => {
                    console.log(`Comparing: "${a.name}" (pos=${a.position}) vs "${b.name}" (pos=${b.position}) => ${b.position - a.position}`);
                    return b.position - a.position;
                });
                
                console.log('Sidebar sorted order:', sortedGroups.map(g => `${g.name} (pos=${g.position})`));
                
                // Добавляем отсортированные группы в правильном порядке
                sortedGroups.forEach(group => {
                    const groupElement = createGroupElement(group);
                    groupList.appendChild(groupElement);
                });
            }
            
            // Обновляем счетчик групп
            updateGroupsCount();
        }
    } catch (error) {
        console.error('Ошибка обновления списка групп в сайдбаре:', error);
    }
}
