document.addEventListener('DOMContentLoaded', () => {
    // Проверка прав пользователя
    const isOwner = document.body.dataset.isOwner === 'true';
    const isMember = document.body.dataset.isMember === 'true';
    const hasEditRights = isOwner || isMember;

    // Инициализация элементов интерфейса
    const initElements = () => {
        return {
            templateModal: document.getElementById('templateModal'),
            selectTemplateModal: document.getElementById('selectTemplateModal'),
            confirmDeleteModal: document.getElementById('confirmDeleteModal'),
            saveTemplateBtn: document.getElementById('saveTemplateBtn'),
            createTemplateBtn: document.getElementById('createTemplateBtn'),
            prevMonthBtn: document.getElementById('prevMonth'),
            nextMonthBtn: document.getElementById('nextMonth'),
            currentMonthEl: document.getElementById('currentMonth'),
            templateTitle: document.getElementById('templateTitle'),
            templateStart: document.getElementById('templateStart'),
            templateEnd: document.getElementById('templateEnd'),
            confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
            toggleFullscreenBtn: document.getElementById('toggleFullscreenBtn'),
            calendarMain: document.querySelector('.calendar-main'),
            fullscreenOverlay: document.getElementById('fullscreenOverlay'),
            toastContainer: document.getElementById('toastContainer') || document.body,
            addMembersBtn: document.getElementById('addMembersBtn'),
            addMembersModal: document.getElementById('addMembersModal'),
            confirmAddMembers: document.getElementById('confirmAddMembers'),
            memberList: document.getElementById('memberList'),
            friendsSelectList: document.getElementById('friendsSelectList')
        };
    };

    const {
        templateModal,
        selectTemplateModal,
        confirmDeleteModal,
        saveTemplateBtn,
        createTemplateBtn,
        prevMonthBtn,
        nextMonthBtn,
        currentMonthEl,
        templateTitle,
        templateStart,
        templateEnd,
        confirmDeleteBtn,
        toggleFullscreenBtn,
        calendarMain,
        fullscreenOverlay,
        toastContainer,
        addMembersBtn,
        addMembersModal,
        confirmAddMembers,
        memberList,
        friendsSelectList
    } = initElements();

    // Русские названия месяцев
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                       "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

    // Текущий месяц и год
    let currentMonth = new Date(document.body.dataset.currentMonth);
    let selectedDate = null;
    let selectedUserId = null;
    let currentTemplateId = null;

    // ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================

    // Показать toast-уведомление
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div>${message}</div>
            <button type="button" class="toast-close">&times;</button>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
    };

    // Обработка ошибок
    const handleError = (error, message = 'Произошла ошибка') => {
        console.error(message, error);
        showToast(message, 'danger');
    };

    // Обновление отображения месяца
    const updateMonthDisplay = async () => {
        const monthName = monthNames[currentMonth.getMonth()];
        currentMonthEl.textContent = `${monthName} ${currentMonth.getFullYear()}`;

        const url = new URL(window.location.href);
        url.searchParams.set('month', currentMonth.toISOString().split('T')[0]);
        window.history.pushState({}, '', url);

        try {
            const response = await fetch(url.toString(), {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) throw new Error('Ошибка загрузки данных');

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newTable = doc.querySelector('.calendar-table');

            if (newTable) {
                const tableContainer = document.querySelector('.calendar-table-container');
                tableContainer.innerHTML = '';
                tableContainer.appendChild(newTable);

                setupCalendarCellHandlers();
                setupShiftHandlers();
            }
        } catch (error) {
            console.error('Ошибка при загрузке календаря:', error);
            showToast('Не удалось загрузить данные календаря', 'danger');
        }
    };

    // Обновление таблицы календаря
    const updateCalendarTable = async () => {
        try {
            const response = await fetch(window.location.href, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) throw new Error('Ошибка загрузки данных');

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newTable = doc.querySelector('.calendar-table');

            if (newTable) {
                const tableContainer = document.querySelector('.calendar-table-container');
                tableContainer.innerHTML = '';
                tableContainer.appendChild(newTable);
                setupCalendarCellHandlers();
                setupShiftHandlers();
            }
        } catch (error) {
            console.error('Ошибка при обновлении таблицы:', error);
        }
    };

    // Функция для обновления списка доступных друзей
    const updateAvailableFriendsList = async () => {
    try {
        const calendarId = document.body.dataset.calendarId;
        const currentUserId = parseInt(document.body.dataset.currentUserId);

        // Получаем текущих участников календаря (включая владельца)
        const currentMembers = new Set(
            Array.from(document.querySelectorAll('.member-item[data-user-id]'))
                .map(item => parseInt(item.dataset.userId))
        );

        // Добавляем владельца календаря (если он не в списке)
        const ownerId = parseInt(document.querySelector('.member-item.owner').dataset.userId);
        currentMembers.add(ownerId);

        // Запрашиваем список друзей текущего пользователя
        const response = await fetch('/api/get_friends', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки списка друзей');
        }

        const friends = await response.json();

        // Фильтруем друзей, исключая уже добавленных и самого себя
        const availableFriends = friends.filter(friend =>
            friend.id !== currentUserId &&
            !currentMembers.has(friend.id)
        );

        const friendsSelectList = document.getElementById('friendsSelectList');
        friendsSelectList.innerHTML = '';

        if (availableFriends.length === 0) {
            friendsSelectList.innerHTML = '<p>Нет доступных коллег для добавления</p>';
            return false;
        }

        // Заполняем список доступных друзей
        availableFriends.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-select-item';
            friendItem.innerHTML = `
                <label>
                    <input type="checkbox" name="selected_friends" value="${friend.id}">
                    <img src="/static/images/${friend.avatar}" 
                         onerror="this.src='/static/images/default_avatar.svg'"
                         class="friend-select-avatar">
                    <span>${friend.username}</span>
                </label>
            `;
            friendsSelectList.appendChild(friendItem);
        });

        return true;
    } catch (error) {
        console.error('Ошибка при обновлении списка друзей:', error);
        showToast('Не удалось загрузить список друзей', 'danger');
        return false;
    }
};

    // ====================== УПРАВЛЕНИЕ УЧАСТНИКАМИ ======================

    const setupMemberManagement = () => {
        if (!addMembersBtn || !addMembersModal) return;

        // Функция для закрытия модального окна
        const closeModal = () => {
            addMembersModal.style.display = 'none';
        };

        // Открытие модального окна
        addMembersBtn.addEventListener('click', async () => {
            const hasAvailableFriends = await updateAvailableFriendsList();

            if (!hasAvailableFriends) {
                showToast('Нет доступных коллег для добавления', 'warning');
                return;
            }

            addMembersModal.style.display = 'flex';
        });

        // Закрытие модального окна
        addMembersModal.querySelectorAll('.modal-close, .btn-outline').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        // Закрытие по клику вне модального окна
        addMembersModal.addEventListener('click', (e) => {
            if (e.target === addMembersModal) {
                closeModal();
            }
        });

        // Обработчик добавления участников
        confirmAddMembers.addEventListener('click', async () => {
            const selectedFriends = Array.from(
                document.querySelectorAll('#friendsSelectList input[name="selected_friends"]:checked')
            ).map(el => el.value);

            if (selectedFriends.length === 0) {
                showToast('Выберите хотя бы одного участника', 'warning');
                return;
            }

            try {
                const response = await fetch(`/calendar/${document.body.dataset.calendarId}/add-members`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_ids: selectedFriends
                    })
                });

                const data = await response.json();

                if (data.success) {
                    showToast('Участники успешно добавлены', 'success');
                    closeModal();

                    // Динамически добавляем новых участников
                    data.added_members.forEach(member => {
                        const memberItem = document.createElement('div');
                        memberItem.className = 'member-item';
                        memberItem.dataset.userId = member.id;
                        memberItem.innerHTML = `
                            <img src="/static/images/${member.avatar}" 
                                 onerror="this.src='/static/images/default_avatar.svg'">
                            <span>${member.username}</span>
                            <button class="btn-remove-member" data-user-id="${member.id}">
                                <i class="bi bi-x"></i>
                            </button>
                        `;
                        memberList.appendChild(memberItem);
                    });

                    // Обновляем список доступных друзей
                    await updateAvailableFriendsList();

                    // Обновляем таблицу календаря
                    updateCalendarTable();
                } else {
                    showToast(data.message || 'Ошибка при добавлении участников', 'danger');
                }
            } catch (error) {
                handleError(error, 'Ошибка при добавлении участников');
            }
        });

        // Обработчик удаления участников
        document.addEventListener('click', async (e) => {
            const removeBtn = e.target.closest('.btn-remove-member');
            if (!removeBtn) return;

            const userId = removeBtn.dataset.userId;
            const memberItem = removeBtn.closest('.member-item');

            try {
                const response = await fetch(`/calendar/${document.body.dataset.calendarId}/remove-member/${userId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                const data = await response.json();

                if (data.success) {
                    showToast('Участник удален', 'success');

                    // Удаляем участника из списка
                    memberItem.remove();

                    // Обновляем список доступных друзей в модальном окне
                    await updateAvailableFriendsList();

                    // Обновляем таблицу календаря
                    updateCalendarTable();
                } else {
                    showToast(data.message || 'Ошибка при удалении участника', 'danger');
                }
            } catch (error) {
                handleError(error, 'Ошибка при удалении участника');
            }
        });
    };

    const searchMemberInput = document.getElementById('searchMemberInput');
    if (searchMemberInput) {
        searchMemberInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.member-item').forEach(item => {
                const name = item.querySelector('.member-name').textContent.toLowerCase();
                item.style.display = name.includes(query) ? 'flex' : 'none';
            });
        });
    }

    const searchTemplateInput = document.getElementById('searchTemplateInput');
    if (searchTemplateInput) {
        searchTemplateInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.template-item').forEach(item => {
                const title = item.querySelector('.template-title').textContent.toLowerCase();
                item.style.display = title.includes(query) ? 'flex' : 'none';
            });
        });
    }

    // ====================== ОСНОВНЫЕ ФУНКЦИИ ======================

    // Навигация по месяцам
    const setupMonthNavigation = () => {
        prevMonthBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            updateMonthDisplay();
        });

        nextMonthBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            updateMonthDisplay();
        });

        // Кнопка "Сегодня"
        const todayBtn = document.createElement('button');
        todayBtn.className = 'btn btn-outline';
        todayBtn.innerHTML = '<i class="bi bi-calendar-event"></i> Сегодня';
        todayBtn.addEventListener('click', () => {
            currentMonth = new Date();
            updateMonthDisplay();
        });
        document.querySelector('.month-navigation').appendChild(todayBtn);
    };

    // Управление модальными окнами
    const setupModals = () => {
        const closeAllModals = () => {
            [templateModal, selectTemplateModal, confirmDeleteModal, addMembersModal].forEach(modal => {
                modal.style.display = 'none';
            });
        };

        // Закрытие модальных окон
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });

        // Закрытие по клику вне модального окна
        window.addEventListener('click', (e) => {
            if ([templateModal, selectTemplateModal, confirmDeleteModal, addMembersModal].includes(e.target)) {
                closeAllModals();
            }
        });

        window.addEventListener('popstate', () => {
            const url = new URL(window.location.href);
            const monthParam = url.searchParams.get('month');

            if (monthParam) {
                currentMonth = new Date(monthParam);
                updateMonthDisplay();
            }
        });

        // Создание шаблона
        if (createTemplateBtn) {
            createTemplateBtn.addEventListener('click', () => {
                templateModal.style.display = 'flex';
            });
        }

        // Сохранение шаблона
        saveTemplateBtn.addEventListener('click', () => {
            const title = templateTitle.value;
            const start = templateStart.value;
            const end = templateEnd.value;

            if (!title || !start || !end) {
                showToast('Заполните все поля', 'danger');
                return;
            }

            createTemplate(title, start, end);
        });
    };

    // Создание нового шаблона смены
    const createTemplate = async (title, start, end) => {
        try {
            const response = await fetch('/api/create_shift_template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    start_time: start,
                    end_time: end,
                    calendar_id: document.body.dataset.calendarId
                })
            });

            const data = await response.json();

            if (data.success) {
                addTemplateToDOM(data.template);
                templateModal.style.display = 'none';
                templateTitle.value = '';
                templateStart.value = '09:00';
                templateEnd.value = '18:00';
                showToast('Шаблон успешно создан', 'success');
            } else {
                showToast(data.error || 'Ошибка при создании шаблона', 'danger');
            }
        } catch (error) {
            handleError(error, 'Ошибка при создании шаблона');
        }
    };

    // Добавление шаблона в DOM
    const addTemplateToDOM = (template) => {
        const templateList = document.getElementById('templateList');
        const selectTemplateList = document.getElementById('selectTemplateList');

        // Если есть сообщение "Нет шаблонов" - удаляем его
        const noTemplates = templateList.querySelector('.no-templates');
        if (noTemplates) {
            noTemplates.remove();
        }

        // Создаем новый элемент шаблона для основного списка
        const templateItem = document.createElement('div');
        templateItem.className = 'template-item';
        templateItem.dataset.templateId = template.id;
        templateItem.innerHTML = `
            <div class="template-info">
                <div class="template-title">${template.title}</div>
                <div class="template-time">${template.start_time} - ${template.end_time}</div>
            </div>
            <div class="template-actions">
                <button class="delete-template-btn" data-template-id="${template.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        // Добавляем с анимацией
        templateItem.style.opacity = '0';
        templateItem.style.transform = 'translateY(10px)';
        templateList.appendChild(templateItem);

        // Создаем элемент для модального окна выбора шаблона
        const selectTemplateItem = document.createElement('div');
        selectTemplateItem.className = 'template-item selectable-template';
        selectTemplateItem.dataset.templateId = template.id;
        selectTemplateItem.innerHTML = `
            <strong>${template.title}</strong><br>
            ${template.start_time} - ${template.end_time}
        `;

        // Проверяем, есть ли сообщение "Нет шаблонов" в модальном окне
        const noTemplatesInModal = selectTemplateList.querySelector('.no-templates');
        if (noTemplatesInModal) {
            selectTemplateList.innerHTML = ''; // Очищаем сообщение
        }

        selectTemplateList.appendChild(selectTemplateItem);

        // Запускаем анимацию
        setTimeout(() => {
            templateItem.style.opacity = '1';
            templateItem.style.transform = 'translateY(0)';
            templateItem.style.transition = 'all 0.3s ease';

            selectTemplateItem.style.opacity = '0';
            selectTemplateItem.style.transform = 'translateY(10px)';
            selectTemplateList.appendChild(selectTemplateItem);

            setTimeout(() => {
                selectTemplateItem.style.opacity = '1';
                selectTemplateItem.style.transform = 'translateY(0)';
                selectTemplateItem.style.transition = 'all 0.3s ease';
            }, 10);
        }, 10);
    };

    // Удаление шаблона
    const deleteTemplate = async (templateId) => {
        try {
            const response = await fetch(`/api/delete_shift_template/${templateId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (data.success) {
                // Удаляем шаблон из DOM
                const templateList = document.getElementById('templateList');
                const selectTemplateList = document.getElementById('selectTemplateList');
                const templateItems = templateList.querySelectorAll('.template-item');
                const selectTemplateItems = selectTemplateList.querySelectorAll('.template-item');

                // Если удаляем последний шаблон
                if (templateItems.length === 1) {
                    // Плавно скрываем последний элемент
                    templateItems[0].classList.add('fade-out');
                    selectTemplateItems[0].classList.add('fade-out');

                    // После анимации удаляем и показываем сообщение
                    setTimeout(() => {
                        templateList.innerHTML = `
                            <div class="no-templates">
                                <i class="bi bi-calendar-x"></i>
                                <p>Нет созданных шаблонов</p>
                            </div>
                        `;

                        selectTemplateList.innerHTML = `
                            <div class="no-templates">
                                <i class="bi bi-calendar-x"></i>
                                <p>Нет созданных шаблонов</p>
                            </div>
                        `;
                    }, 300);
                } else {
                    // Если не последний - просто удаляем
                    removeTemplateFromDOM(templateId);
                }

                showToast('Шаблон удален', 'success');
            } else {
                showToast(data.error || 'Ошибка при удалении шаблона', 'danger');
            }
        } catch (error) {
            handleError(error, 'Ошибка при удалении шаблона');
        }
    };

    // Новая функция для проверки пустого списка
    const checkEmptyTemplatesList = () => {
        const templateList = document.getElementById('templateList');
        const selectTemplateList = document.getElementById('selectTemplateList');
        const templateItems = templateList.querySelectorAll('.template-item');
        const selectTemplateItems = selectTemplateList.querySelectorAll('.template-item');

        if (templateItems.length === 0) {
            templateList.innerHTML = `
                <div class="no-templates" style="text-align: center; padding: 1rem; color: #64748b;">
                    <i class="bi bi-calendar-x" style="font-size: 1.5rem;"></i>
                    <p>Нет созданных шаблонов</p>
                </div>
            `;
        }

        if (selectTemplateItems.length === 0) {
            selectTemplateList.innerHTML = `
                <div class="no-templates" style="text-align: center; padding: 1rem; color: #64748b;">
                    <i class="bi bi-calendar-x" style="font-size: 1.5rem;"></i>
                    <p>Нет созданных шаблонов</p>
                </div>
            `;
        }
    };

    // Удаление шаблона из DOM
    const removeTemplateFromDOM = (templateId) => {
        // Удаляем из основного списка
        const templateItems = document.querySelectorAll(`.template-item[data-template-id="${templateId}"]`);
        templateItems.forEach(el => {
            el.classList.add('fade-out');
            setTimeout(() => el.remove(), 300);
        });

        // Удаляем из модального окна выбора
        const selectTemplateItems = document.querySelectorAll(`.selectable-template[data-template-id="${templateId}"]`);
        selectTemplateItems.forEach(el => {
            el.classList.add('fade-out');
            setTimeout(() => el.remove(), 300);
        });

        // Проверяем, не остался ли список пустым
        setTimeout(() => {
            checkEmptyTemplatesList();
        }, 350);
    };

    // Добавление смены из шаблона
    const addShiftFromTemplate = async (templateId) => {
        try {
            const response = await fetch('/api/add_shift_from_template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    template_id: templateId,
                    date: selectedDate,
                    user_id: selectedUserId,
                    calendar_id: document.body.dataset.calendarId
                })
            });

            const data = await response.json();

            if (data.success) {
                showToast('Смена успешно добавлена', 'success');

                // Динамически добавляем смену в ячейку
                const cell = document.querySelector(`.day-cell[data-date="${selectedDate}"][data-user-id="${selectedUserId}"]`);
                if (cell) {
                    const shiftBadge = document.createElement('div');
                    shiftBadge.className = 'shift-badge';
                    shiftBadge.dataset.shiftId = data.shift.id;
                    shiftBadge.innerHTML = `
                        ${data.shift.title} (${data.shift.start_time}-${data.shift.end_time})
                        <button class="remove-shift-btn" data-shift-id="${data.shift.id}">&times;</button>
                    `;
                    cell.appendChild(shiftBadge);
                    cell.classList.add('has-shift');

                    // Назначаем обработчик для новой кнопки удаления
                    shiftBadge.querySelector('.remove-shift-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteShift(data.shift.id);
                    });
                }

                selectTemplateModal.style.display = 'none';
            } else {
                showToast(data.error || 'Ошибка при добавлении смены', 'danger');
            }
        } catch (error) {
            handleError(error, 'Ошибка при добавлении смены');
        }
    };

    // Удаление смены
    const deleteShift = async (shiftId) => {
        try {
            const response = await fetch(`/shift/${shiftId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    showToast('Смена успешно удалена', 'success');
                    const shiftBadge = document.querySelector(`.shift-badge[data-shift-id="${shiftId}"]`);
                    if (shiftBadge) {
                        const cell = shiftBadge.closest('.day-cell');
                        shiftBadge.remove();
                        if (cell && !cell.querySelector('.shift-badge')) {
                            cell.classList.remove('has-shift');
                        }
                    }
                }
            } else {
                const error = await response.text();
                showToast(error || 'Ошибка при удалении смены', 'danger');
            }
        } catch (error) {
            handleError(error, 'Ошибка при удалении смены');
        }
    };

    // ====================== ОБРАБОТЧИКИ СОБЫТИЙ ======================

    // Обработка кликов по шаблонам
    const setupTemplateHandlers = () => {
        // Обработчик для кнопок удаления шаблонов
        document.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-template-btn');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                currentTemplateId = deleteBtn.dataset.templateId;
                confirmDeleteModal.style.display = 'flex';
            }
        });

        // Подтверждение удаления
        confirmDeleteBtn.addEventListener('click', () => {
            if (currentTemplateId) {
                deleteTemplate(currentTemplateId);
                confirmDeleteModal.style.display = 'none';
                currentTemplateId = null;
            }
        });

        // Выбор шаблона для добавления смены
        document.addEventListener('click', (e) => {
            const templateItem = e.target.closest('.selectable-template');
            if (templateItem && selectedDate && selectedUserId) {
                addShiftFromTemplate(templateItem.dataset.templateId);
            }
        });
    };

    // Установка обработчиков для кнопок удаления смен
    const setupShiftHandlers = () => {
        document.querySelectorAll('.remove-shift-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (!isOwner) {
                    showToast('Только создатель календаря может удалять смены', 'warning');
                    return;
                }

                const shiftId = e.target.dataset.shiftId;
                try {
                    const response = await fetch(`/shift/${shiftId}/delete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        credentials: 'same-origin'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            showToast('Смена успешно удалена', 'success');
                            const shiftBadge = document.querySelector(`.shift-badge[data-shift-id="${shiftId}"]`);
                            if (shiftBadge) {
                                const cell = shiftBadge.closest('.day-cell');
                                shiftBadge.remove();
                                if (cell && !cell.querySelector('.shift-badge')) {
                                    cell.classList.remove('has-shift');
                                }
                            }
                        }
                    } else {
                        const error = await response.text();
                        showToast(error || 'Ошибка при удалении смены', 'danger');
                    }
                } catch (error) {
                    handleError(error, 'Ошибка при удалении смены');
                }
            });
        });
    };

    // Обработка кликов по ячейкам календаря
    const setupCalendarCellHandlers = () => {
        document.querySelectorAll('.day-cell').forEach(cell => {
            // Проверяем, является ли пользователь владельцем календаря
            const isOwner = document.body.dataset.isOwner === 'true';

            // Только для владельца календаря
            if (isOwner) {
                cell.addEventListener('click', (e) => {
                    if (e.target.closest('.remove-shift-btn') || e.target.closest('.shift-badge')) return;

                    selectedDate = cell.dataset.date;
                    selectedUserId = cell.dataset.userId;

                    // Проверяем, есть ли уже смена в этой ячейке
                    if (!cell.classList.contains('has-shift')) {
                        selectTemplateModal.style.display = 'flex';
                    }
                });
            }
        });
    };

    const setupFullscreenToggle = () => {
        const btn = toggleFullscreenBtn;
        const calendar = document.querySelector('.calendar-main');
        const icon = btn.querySelector('i');
        const overlay = fullscreenOverlay;

        let isFullscreen = false;

        btn.addEventListener('click', () => {
            if (!isFullscreen) {
                calendar.classList.add('animating-open');
                calendar.classList.add('fullscreen');
                document.body.classList.add('fullscreen-active');

                requestAnimationFrame(() => {
                    calendar.classList.remove('animating-open');
                });

                btn.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
            } else {
                calendar.style.transformOrigin = 'bottom right';
                calendar.style.transform = 'translateX(-50%) scale(0.7)';
                calendar.style.opacity = '0';

                overlay.style.pointerEvents = 'none';

                setTimeout(() => {
                    calendar.classList.remove('fullscreen');
                    calendar.style.transform = '';
                    calendar.style.opacity = '';
                    document.body.classList.remove('fullscreen-active');
                }, 400);

                btn.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
            }

            isFullscreen = !isFullscreen;
        });

        // Клик по фону также сворачивает календарь
        overlay.addEventListener('click', () => {
            if (!isFullscreen) return;
            btn.click();
        });
    };

    // ====================== ИНИЦИАЛИЗАЦИЯ ======================

    // Скрываем элементы управления для пользователей без прав
    if (!hasEditRights) {
        document.querySelectorAll('.remove-shift-btn, .delete-template-btn').forEach(btn => {
            btn.style.display = 'none';
        });

        if (createTemplateBtn) createTemplateBtn.style.display = 'none';
    }

    // Инициализация всех обработчиков
    const init = () => {
        updateMonthDisplay();
        setupMonthNavigation();
        setupModals();
        setupTemplateHandlers();
        setupShiftHandlers();
        setupMemberManagement();
        setupCalendarCellHandlers();
        setupFullscreenToggle();
    };

    init();
});