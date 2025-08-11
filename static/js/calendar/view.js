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
            todayBtn: document.getElementById('todayBtn'),
            toggleFullscreenBtn: document.getElementById('toggleFullscreenBtn'),
            calendarMain: document.querySelector('.calendar-main'),
            fullscreenOverlay: document.getElementById('fullscreenOverlay'),
            toastContainer: document.getElementById('toastContainer') || document.body,
            addMembersBtn: document.getElementById('addMembersBtn'),
            addMembersModal: document.getElementById('addMembersModal'),
            confirmAddMembers: document.getElementById('confirmAddMembers'),
            memberList: document.getElementById('memberList'),
            clearAllShiftsBtn: isOwner ? document.getElementById('clearAllShiftsBtn') : null,
            confirmClearAllModal: document.getElementById('confirmClearAllModal'),
            confirmClearAllBtn: document.getElementById('confirmClearAllBtn'),
            userRowsContainer: document.querySelector('.calendar-table tbody'),
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
                setupDraggableRows(); // Добавляем эту строку
            }
        } catch (error) {
            console.error('Ошибка при загрузке календаря:', error);
            showToast('Не удалось загрузить данные календаря', 'danger');
        }
    };

    // Обновление таблицы календаря
    const updateCalendarTable = async () => {
        try {
            const calendarId = document.body.dataset.calendarId;
            const month = currentMonth.toISOString().split('T')[0];

            const response = await fetch(`/calendar/${calendarId}?month=${month}`, {
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
                setupDraggableRows();
            }
        } catch (error) {
            console.error('Ошибка при обновлении таблицы:', error);
            showToast('Не удалось обновить таблицу', 'danger');
        }
    };

    // Функция для обновления списка доступных друзей
    const updateAvailableFriendsList = async () => {
        try {
            const calendarId = document.body.dataset.calendarId;
            const currentUserId = parseInt(document.body.dataset.currentUserId);

            // Запрашиваем текущих участников календаря
            const membersResponse = await fetch(`/calendar/${calendarId}/members`, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!membersResponse.ok) {
                throw new Error('Ошибка загрузки списка участников');
            }

            const currentMembers = await membersResponse.json();

            // Запрашиваем список друзей текущего пользователя
            const friendsResponse = await fetch('/api/get_friends', {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!friendsResponse.ok) {
                throw new Error('Ошибка загрузки списка друзей');
            }

            const friends = await friendsResponse.json();

            // Фильтруем друзей
            const availableFriends = friends.filter(friend =>
                friend.id !== currentUserId &&
                !currentMembers.some(member => member.id === friend.id)
            );

            const friendsSelectList = document.getElementById('friendsSelectList');
            friendsSelectList.innerHTML = '';

            if (availableFriends.length === 0) {
                friendsSelectList.innerHTML = '<p class="text-muted">Нет доступных коллег для добавления</p>';
                return false;
            }

            // Заполняем список
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

    if (!isOwner) {
        const calendarMain = document.querySelector('.calendar-main');
        const gridContainer = document.querySelector('.calendar-grid-container');
        if (calendarMain && gridContainer) {
            calendarMain.classList.add('full-width');
            gridContainer.style.gridTemplateColumns = '1fr';
        }
    }

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

                if (!response.ok) {
                    throw new Error(data.message || 'Ошибка при добавлении участников');
                }

                // Закрываем модальное окно
                addMembersModal.style.display = 'none';

                // Обновляем таблицу календаря
                await updateCalendarTable();

                // Обновляем список участников в сайдбаре (проверяем существование элемента)
                const memberList = document.getElementById('memberList');
                if (memberList && data.added_members) {
                    data.added_members.forEach(member => {
                        const memberItem = document.createElement('div');
                        memberItem.className = 'member-item';
                        memberItem.dataset.userId = member.id;
                        memberItem.innerHTML = `
                            <img src="/static/images/${member.avatar || 'default_avatar.svg'}" 
                                 onerror="this.src='/static/images/default_avatar.svg'">
                            <span>${member.username}</span>
                        `;
                        memberList.appendChild(memberItem);
                    });
                }

                // Очищаем выбранные элементы в модальном окне
                document.querySelectorAll('#friendsSelectList input:checked').forEach(checkbox => {
                    checkbox.checked = false;
                });

                // Обновляем список доступных друзей
                await updateAvailableFriendsList();
                setupDraggableRows();

                showToast('Участники успешно добавлены', 'success');

            } catch (error) {
                console.error('Error adding members:', error);
                showToast(error.message || 'Ошибка при добавлении участников', 'danger');
            }
        });

        // Обработчик удаления участников
        document.addEventListener('click', async (e) => {
            const removeBtn = e.target.closest('.btn-remove-member');
            if (!removeBtn) return;

            const userId = removeBtn.dataset.userId;
            const memberItem = removeBtn.closest('.user-row');

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
                    // Удаляем участника из DOM сразу
                    if (memberItem) {
                        memberItem.remove();
                    }

                    // Удаляем участника из списка в сайдбаре
                    const sidebarMember = document.querySelector(`.member-item[data-user-id="${userId}"]`);
                    if (sidebarMember) {
                        sidebarMember.remove();
                    }

                    // Показываем только одно уведомление
                    showToast('Участник удален', 'success');

                    // Обновляем таблицу календаря
                    await updateCalendarTable();
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

    const checkEmptyMembersList = () => {
        const memberList = document.getElementById('memberList');
        if (!memberList) return;

        const memberItems = memberList.querySelectorAll('.member-item:not(.owner)');
        if (memberItems.length === 0) {
            showToast('Список участников пуст', 'info');
        }
    };

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

        todayBtn.addEventListener('click', () => {
            currentMonth = new Date();
            updateMonthDisplay();
        });

        // Обработчик для кнопки очистки
        const clearAllShiftsBtn = document.getElementById('clearAllShiftsBtn');
        if (clearAllShiftsBtn) {
            clearAllShiftsBtn.addEventListener('click', () => {
                confirmClearAllModal.style.display = 'flex';
            });
        }

        // Подтверждение очистки
        if (confirmClearAllBtn) {
            confirmClearAllBtn.addEventListener('click', () => {
                confirmClearAllModal.style.display = 'none';
                clearAllShifts();
            });
        }

        confirmClearAllModal.addEventListener('click', (e) => {
            if (e.target === confirmClearAllModal) {
                confirmClearAllModal.style.display = 'none';
            }
        });

        // Закрытие модального окна при клике на крестик или кнопку "Отмена"
        const closeButtons = confirmClearAllModal.querySelectorAll('.modal-closee, .btn-outline');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                confirmClearAllModal.style.display = 'none';
            });
        });
    };

    // Управление модальными окнами
    const setupModals = () => {
        // Элементы модальных окон
        const templateModal = document.getElementById('templateModal');
        const selectTemplateModal = document.getElementById('selectTemplateModal');
        const confirmDeleteModal = document.getElementById('confirmDeleteModal');
        const addMembersModal = document.getElementById('addMembersModal');

        // Элементы формы
        const templateTitle = document.getElementById('templateTitle');
        const templateStart = document.getElementById('templateStart');
        const templateEnd = document.getElementById('templateEnd');
        const showTimeCheckbox = document.getElementById('showTimeCheckbox');
        const timeFieldsContainer = document.getElementById('timeFieldsContainer');
        const badgePreview = document.getElementById('badgePreview');
        const colorOptions = document.querySelectorAll('.color-option');

        // Кнопки
        const createTemplateBtn = document.getElementById('createTemplateBtn');
        const saveTemplateBtn = document.getElementById('saveTemplateBtn');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

        // Закрытие всех модальных окон
        const closeAllModals = () => {
            [templateModal, selectTemplateModal, confirmDeleteModal, addMembersModal].forEach(modal => {
                modal.style.display = 'none';
            });
        };

        // Обработчики закрытия модальных окон
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });

        // Закрытие по клику вне модального окна
        window.addEventListener('click', (e) => {
            if ([templateModal, selectTemplateModal, confirmDeleteModal, addMembersModal].includes(e.target)) {
                closeAllModals();
            }
        });

        // Функция обновления предпросмотра бейджа
        const updateBadgePreview = () => {
            const titleText = templateTitle.value || 'Название';
            const shortTitle = titleText.length > 8
                ? `${titleText.substring(0, 8)}...`
                : titleText;

            const selectedColor = document.querySelector('.color-option.selected')?.dataset.colorClass || 'badge-color-1';

            badgePreview.className = `preview-badge ${selectedColor}`;

            if (showTimeCheckbox.checked) {
                badgePreview.innerHTML = `${shortTitle}<br>${templateStart.value} - ${templateEnd.value}`;
            } else {
                badgePreview.textContent = shortTitle;
            }
        };

        // Инициализация предпросмотра бейджа
        const setupBadgePreview = () => {
            // Обработчики изменений
            templateTitle.addEventListener('input', updateBadgePreview);
            templateStart.addEventListener('change', updateBadgePreview);
            templateEnd.addEventListener('change', updateBadgePreview);
            showTimeCheckbox.addEventListener('change', updateBadgePreview);

            // Обработчики выбора цвета
            colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    colorOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    updateBadgePreview();
                });
            });

            // Первоначальная настройка
            updateBadgePreview();
        };

        // Обработчик чекбокса показа времени
        if (showTimeCheckbox && timeFieldsContainer) {
            showTimeCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    timeFieldsContainer.classList.remove('hidden');
                } else {
                    timeFieldsContainer.classList.add('hidden');
                }
                updateBadgePreview();
            });
        }

        // Обработчик кнопки создания шаблона
        if (createTemplateBtn) {
            createTemplateBtn.addEventListener('click', () => {
                // Сброс формы
                templateTitle.value = '';
                templateStart.value = '09:00';
                templateEnd.value = '18:00';
                showTimeCheckbox.checked = true;
                timeFieldsContainer.classList.remove('hidden');

                // Сброс выбора цвета
                colorOptions.forEach((opt, i) => {
                    opt.classList.toggle('selected', i === 0);
                });

                // Обновление предпросмотра
                updateBadgePreview();

                // Открытие модального окна
                templateModal.style.display = 'flex';
                templateTitle.focus();
            });
        }

        // Обработчик кнопки сохранения шаблона
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', async () => {
                const title = templateTitle.value.trim();
                const start = templateStart.value;
                const end = templateEnd.value;

                if (!title) {
                    showToast('Введите название смены', 'danger');
                    return;
                }

                if (title.length > 20) {
                    showToast('Название должно быть не более 20 символов', 'danger');
                    return;
                }

                const showTime = showTimeCheckbox.checked;
                if (showTime && (!start || !end)) {
                    showToast('Заполните время смены', 'danger');
                    return;
                }

                try {
                    const selectedColor = document.querySelector('.color-option.selected')?.dataset.colorClass || 'badge-color-1';
                    const calendarId = document.body.dataset.calendarId;

                    const response = await fetch('/api/create_shift_template', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            title: title,
                            start_time: start,
                            end_time: end,
                            calendar_id: calendarId,
                            show_time: showTime,
                            color_class: selectedColor
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        addTemplateToDOM(data.template);
                        templateModal.style.display = 'none';
                        showToast('Шаблон успешно создан', 'success');
                    } else {
                        showToast(data.error || 'Ошибка при создании шаблона', 'danger');
                    }
                } catch (error) {
                    console.error('Ошибка:', error);
                    showToast('Ошибка при создании шаблона', 'danger');
                }
            });
        }

        // Обработчик подтверждения удаления
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                if (currentTemplateId) {
                    deleteTemplate(currentTemplateId);
                    confirmDeleteModal.style.display = 'none';
                    currentTemplateId = null;
                }
            });
        }

        // Инициализация предпросмотра
        setupBadgePreview();
    };

    // Создание нового шаблона смены
    const createTemplate = async (title, start, end) => {
        try {
            const showTime = document.getElementById('showTimeCheckbox').checked;
            const selectedColor = document.querySelector('.color-option.selected').dataset.colorClass;

            const response = await fetch('/api/create_shift_template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    start_time: start,
                    end_time: end,
                    calendar_id: document.body.dataset.calendarId,
                    show_time: showTime,
                    color_class: selectedColor // Важно: передаем выбранный цвет
                })
            });

            const data = await response.json();

            if (data.success) {
                // Убедимся, что сервер возвращает color_class
                if (!data.template.color_class) {
                    data.template.color_class = selectedColor;
                }

                addTemplateToDOM(data.template);
                templateModal.style.display = 'none';
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

        // Удаляем сообщение "Нет шаблонов", если есть
        const noTemplates = templateList.querySelector('.no-templates');
        if (noTemplates) noTemplates.remove();

        // Формируем отображение с учетом цвета
        const timeDisplay = template.show_time
            ? `${template.start_time} - ${template.end_time}`
            : 'Без указания времени';

        // Основной список шаблонов
        const templateItem = document.createElement('div');
        templateItem.className = `template-item ${template.color_class}`;
        templateItem.dataset.templateId = template.id;
        templateItem.innerHTML = `
            <div class="template-info">
                <div class="template-title">${template.title}</div>
                <div class="template-time">${timeDisplay}</div>
            </div>
            <div class="template-actions">
                <button class="delete-template-btn" data-template-id="${template.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;

        // Список для выбора шаблона (в модальном окне)
        const selectTemplateItem = document.createElement('div');
        selectTemplateItem.className = `template-item selectable-template ${template.color_class}`;
        selectTemplateItem.dataset.templateId = template.id;
        selectTemplateItem.innerHTML = `
            <strong>${template.title}</strong><br>
            ${timeDisplay}
        `;

        // Добавляем в оба списка
        templateList.appendChild(templateItem);
        selectTemplateList.appendChild(selectTemplateItem);

        // Удаляем сообщение "Нет шаблонов" из модального окна, если оно есть
        const noTemplatesInModal = selectTemplateList.querySelector('.no-templates');
        if (noTemplatesInModal) {
            noTemplatesInModal.remove();
        }

        // Анимация появления
        templateItem.style.opacity = '0';
        templateItem.style.transform = 'translateY(10px)';
        selectTemplateItem.style.opacity = '0';
        selectTemplateItem.style.transform = 'translateY(10px)';

        setTimeout(() => {
            templateItem.style.opacity = '1';
            templateItem.style.transform = 'translateY(0)';
            templateItem.style.transition = 'all 0.3s ease';

            selectTemplateItem.style.opacity = '1';
            selectTemplateItem.style.transform = 'translateY(0)';
            selectTemplateItem.style.transition = 'all 0.3s ease';
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
                const cell = document.querySelector(`.day-cell[data-date="${selectedDate}"][data-user-id="${selectedUserId}"]`);
                if (cell) {
                    const shiftBadge = document.createElement('div');
                    const colorClass = data.shift.color_class || 'badge-color-1';  // Используем цвет из ответа
                    shiftBadge.className = `shift-badge ${colorClass}`;
                    shiftBadge.dataset.shiftId = data.shift.id;

                    const showTime = data.shift.show_time;
                    const title = data.shift.title;
                    const shortTitle = title.length > 8 ? `${title.substring(0, 8)}...` : title;

                    shiftBadge.innerHTML = shortTitle;
                    if (showTime) {
                        shiftBadge.innerHTML += `<br>${data.shift.start_time} - ${data.shift.end_time}`;
                    }

                    if (isOwner) {
                        shiftBadge.innerHTML += `<button class="remove-shift-btn" data-shift-id="${data.shift.id}">&times;</button>`;
                    }

                    cell.appendChild(shiftBadge);
                    setupShiftHandlers();
                }
                selectTemplateModal.style.display = 'none';
            }
        } catch (error) {
            handleError(error, 'Ошибка при добавлении смены');
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
        // Удаляем старые обработчики
        document.querySelectorAll('.remove-shift-btn').forEach(btn => {
            btn.removeEventListener('click', handleShiftDelete);
        });

        // Добавляем новые обработчики
        document.querySelectorAll('.remove-shift-btn').forEach(btn => {
            btn.addEventListener('click', handleShiftDelete);
        });
    };

    const handleShiftDelete = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        const shiftId = e.target.dataset.shiftId;
        const shiftBadge = document.querySelector(`.shift-badge[data-shift-id="${shiftId}"]`);
        const cell = shiftBadge?.closest('.day-cell');
        const userId = cell?.dataset.userId;
        const isOwner = document.body.dataset.calendarOwnerId === document.body.dataset.currentUserId;
        const currentUserId = parseInt(document.body.dataset.currentUserId);

        if (!isOwner && parseInt(userId) !== currentUserId) {
            showToast('Вы можете удалять только свои смены', 'warning');
            return;
        }

        try {
            const response = await fetch(`/shift/${shiftId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(response.status === 404 ? 'Смена не найдена' : 'Ошибка сервера');
            }

            const data = await response.json();
            if (data.success) {
                shiftBadge?.classList.add('removing');
                setTimeout(() => {
                    shiftBadge?.remove();
                    if (cell && !cell.querySelector('.shift-badge')) {
                        cell.classList.remove('has-shift');
                    }
                }, 300);
            }
        } catch (error) {
            console.error('Ошибка при удалении смены:', error);
        }
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
                    const hasShift = cell.querySelector('.shift-badge') !== null;
                    if (!hasShift) {
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

    // Синхронизация горизонтальной прокрутки
    const syncHorizontalScroll = () => {
        const tableContainer = document.querySelector('.calendar-table-container');
        const header = document.querySelector('.calendar-table thead');
        const firstColumn = document.querySelectorAll('.user-cell');

        if (!tableContainer) return;

        tableContainer.addEventListener('scroll', (e) => {
            // Синхронизация заголовка
            if (header) {
                header.style.transform = `translateX(-${e.target.scrollLeft}px)`;
            }

            // Синхронизация первого столбца (если нужна вертикальная прокрутка)
            const scrollTop = e.target.scrollTop;
            firstColumn.forEach(cell => {
                cell.style.transform = `translateY(${scrollTop}px)`;
            });
        });
    };

    const adjustTableLayout = () => {
        const headerCells = document.querySelectorAll('.calendar-table thead th');
        const firstRowCells = document.querySelectorAll('.user-row:first-child td');

        // Синхронизируем ширину ячеек
        if (headerCells.length > 0 && firstRowCells.length > 0) {
            firstRowCells.forEach((cell, index) => {
                if (headerCells[index]) {
                    const width = headerCells[index].offsetWidth;
                    cell.style.minWidth = `${width}px`;
                    cell.style.maxWidth = `${width}px`;
                }
            });
        }

        // Проверяем, не вылезает ли содержимое
        document.querySelectorAll('.day-cell').forEach(cell => {
            const content = cell.querySelector('.shift-badge');
            if (content && content.offsetHeight > cell.offsetHeight - 5) {
                cell.style.overflowY = 'auto';
            }
        });
    };

    // Вызываем при загрузке и при изменении размеров
    window.addEventListener('load', adjustTableLayout);
    window.addEventListener('resize', adjustTableLayout);


    const clearAllShifts = async () => {
        try {
            document.querySelectorAll('.shift-badge').forEach(badge => {
                badge.classList.add('removing');
            });

            const calendarId = document.body.dataset.calendarId;
            const response = await fetch(`/calendar/${calendarId}/clear-all-shifts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const data = await response.json();

            if (data.success) {
                showToast('Все смены успешно удалены', 'success');
                setTimeout(updateCalendarTable, 300);
            } else {
                document.querySelectorAll('.shift-badge').forEach(badge => {
                    badge.classList.remove('removing');
                });
                showToast(data.message || 'Ошибка при удалении смен', 'danger');
            }
        } catch (error) {
            handleError(error, 'Ошибка при удалении смен');
        }
    };


    const setupDraggableRows = () => {
        const tbody = document.querySelector('.calendar-table tbody');
        if (!tbody) {
            console.error('Table body not found');
            return;
        }

        const draggableRows = tbody.querySelectorAll('.user-row:not(.owner)');
            if (draggableRows.length === 0) {
                console.log('No draggable members found');
                return;
            }

        if (tbody.sortableInstance) {
                tbody.sortableInstance.destroy();
            }

        // Находим строку владельца календаря
        const ownerRow = tbody.querySelector('.user-row.owner');
        if (!ownerRow) return;

        new Sortable(tbody, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                handle: '.user-cell',
                filter: '.owner',
                draggable: '.user-row:not(.owner)',

                onStart: function(evt) {
                    if (evt.item.classList.contains('owner')) {
                        evt.preventDefault();
                    }
                },
                onMove: function(evt) {
                    // Запрещаем перемещение выше владельца
                    const ownerIndex = Array.from(tbody.children).indexOf(ownerRow);
                    const draggedIndex = Array.from(tbody.children).indexOf(evt.dragged);
                    const targetIndex = Array.from(tbody.children).indexOf(evt.related);

                    // Если пытаемся переместить выше владельца - запрещаем
                    if (targetIndex < ownerIndex) {
                        return false;
                    }
                },
                onEnd: function(evt) {
                    evt.item.style.backgroundColor = '';
                    if (evt.item.classList.contains('owner') || evt.oldIndex === evt.newIndex) return;
                    updateMemberPositions();
                }
            });

        console.log('SortableJS инициализирован');
    };

    const updateMemberPositions = async () => {
        const rows = document.querySelectorAll('.user-row:not(.owner)');
        if (rows.length === 0) return;

        const positions = {};
        const calendarId = document.body.dataset.calendarId;

        rows.forEach((row, index) => {
            const userId = row.dataset.userId || row.querySelector('.user-cell').dataset.userId;
            if (userId) positions[userId] = index + 1;
        });

        try {
            const response = await fetch(`/calendar/${calendarId}/update-positions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ positions })
            });

            if (!response.ok) {
                const errorData = await response.json();

                // Обрабатываем ошибку 403 Forbidden
                if (response.status === 403) {
                    throw new Error('У вас нет прав на изменение порядка участников!');
                }

                throw new Error(errorData.error || 'Неизвестная ошибка сервера');
            }

            showToast('Порядок участников сохранён', 'success');
        } catch (error) {
            // Показываем пользовательское сообщение для ошибки 403
            const errorMessage = error.message.includes('403')
                ? 'У вас нет прав на изменение порядка участников!'
                : error.message;

            showToast(`Не удалось сохранить порядок: ${errorMessage}`, 'danger');
            updateCalendarTable(); // Восстанавливаем предыдущий порядок
        }
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
        syncHorizontalScroll();
        adjustTableLayout();
        setTimeout(() => {
        setupDraggableRows();
        }, 500);
    };

    init();
});