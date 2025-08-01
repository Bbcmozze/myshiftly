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
            addMemberBtn: document.getElementById('addMemberBtn'),
            templateList: document.getElementById('templateList'),
            selectTemplateList: document.getElementById('selectTemplateList'),
            currentMonthEl: document.getElementById('currentMonth'),
            templateTitle: document.getElementById('templateTitle'),
            templateStart: document.getElementById('templateStart'),
            templateEnd: document.getElementById('templateEnd'),
            friendSelect: document.getElementById('friendSelect'),
            confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
            toastContainer: document.getElementById('toastContainer') || document.body
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
        addMemberBtn,
        templateList,
        selectTemplateList,
        currentMonthEl,
        templateTitle,
        templateStart,
        templateEnd,
        friendSelect,
        confirmDeleteBtn,
        toastContainer
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

        // Анимация появления
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Автоматическое скрытие через 3 секунды
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);

        // Закрытие по клику
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
    const updateMonthDisplay = () => {
        const monthName = monthNames[currentMonth.getMonth()];
        currentMonthEl.textContent = `${monthName} ${currentMonth.getFullYear()}`;

        const url = new URL(window.location.href);
        url.searchParams.set('month', currentMonth.toISOString().split('T')[0]);
        window.history.pushState({}, '', url);
    };

    // Обновление ячейки календаря после добавления смены
    const updateCalendarCell = (date, userId, shiftData) => {
        const cell = document.querySelector(`.day-cell[data-date="${date}"][data-user-id="${userId}"]`);
        if (!cell) return;

        // Проверяем, есть ли уже смена в этой ячейке
        const existingShift = cell.querySelector('.shift-badge');
        if (existingShift) {
            showToast('В этот день уже есть смена', 'warning');
            return;
        }

        cell.classList.add('has-shift');

        const shiftBadge = document.createElement('div');
        shiftBadge.className = 'shift-badge';
        shiftBadge.dataset.shiftId = shiftData.id;
        shiftBadge.innerHTML = `
            ${shiftData.title} (${shiftData.start_time}-${shiftData.end_time})
            <button class="remove-shift-btn" data-shift-id="${shiftData.id}">&times;</button>
        `;

        cell.appendChild(shiftBadge);

        // Переустанавливаем обработчики для новой кнопки удаления
        setupShiftHandlers();
    };

    // ====================== ОСНОВНЫЕ ФУНКЦИИ ======================

    // Навигация по месяцам
    const setupMonthNavigation = () => {
        prevMonthBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            updateMonthDisplay();
            location.reload();
        });

        nextMonthBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            updateMonthDisplay();
            location.reload();
        });
    };

    // Управление модальными окнами
    const setupModals = () => {
        const closeAllModals = () => {
            [templateModal, selectTemplateModal, confirmDeleteModal].forEach(modal => {
                modal.style.display = 'none';
            });
        };

        // Закрытие модальных окон
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });

        // Закрытие по клику вне модального окна
        window.addEventListener('click', (e) => {
            if ([templateModal, selectTemplateModal, confirmDeleteModal].includes(e.target)) {
                closeAllModals();
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
        // В список шаблонов
        const templateItem = document.createElement('div');
        templateItem.className = 'template-item';
        templateItem.dataset.templateId = template.id;
        templateItem.innerHTML = `
            <div>
                <strong>${template.title}</strong><br>
                ${template.start_time} - ${template.end_time}
            </div>
            <div class="template-actions">
                <small class="text-muted">ID: ${template.id}</small>
                <button class="btn btn-sm btn-outline-danger delete-template-btn"
                        data-template-id="${template.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        templateList.appendChild(templateItem);

        // В модальное окно выбора
        const selectTemplateItem = document.createElement('div');
        selectTemplateItem.className = 'template-item selectable-template';
        selectTemplateItem.dataset.templateId = template.id;
        selectTemplateItem.innerHTML = `
            <strong>${template.title}</strong><br>
            ${template.start_time} - ${template.end_time}
        `;
        selectTemplateList.appendChild(selectTemplateItem);
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
                removeTemplateFromDOM(templateId);
                showToast('Шаблон успешно удален', 'success');
            } else {
                showToast(data.error || 'Ошибка при удалении шаблона', 'danger');
            }
        } catch (error) {
            handleError(error, 'Ошибка при удалении шаблона');
        }
    };

    // Удаление шаблона из DOM
    const removeTemplateFromDOM = (templateId) => {
        document.querySelectorAll(`[data-template-id="${templateId}"]`).forEach(el => {
            el.classList.add('fade-out');
            setTimeout(() => el.remove(), 300);
        });
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
                        shiftBadge.remove();
                        const cell = shiftBadge.closest('.day-cell');
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

    // Добавление участников (только для владельца)
    const setupMemberHandlers = () => {
        if (isOwner && addMemberBtn) {
            addMemberBtn.addEventListener('click', async () => {
                const userId = friendSelect.value;

                if (!userId) {
                    showToast('Выберите коллегу', 'danger');
                    return;
                }

                try {
                    const response = await fetch(`/calendar/${document.body.dataset.calendarId}/add-member`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: `user_id=${userId}`
                    });

                    const data = await response.json();

                    if (data.success) {
                        showToast(data.message, 'success');
                        // Обновляем страницу
                        window.location.reload();
                    } else {
                        showToast(data.message, 'danger');
                    }
                } catch (error) {
                    handleError(error, 'Ошибка при добавлении участника');
                }
            });
        }
    };

    // ====================== ОБРАБОТЧИКИ СОБЫТИЙ ======================

    // Обработка кликов по шаблонам
    const setupTemplateHandlers = () => {
        // Удаление шаблона
        document.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-template-btn');
            if (!deleteBtn) return;

            e.preventDefault();
            e.stopPropagation();

            currentTemplateId = deleteBtn.dataset.templateId;
            confirmDeleteModal.style.display = 'flex';
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
        selectTemplateList.addEventListener('click', (e) => {
            const templateItem = e.target.closest('.selectable-template');
            if (templateItem && selectedDate && selectedUserId) {
                addShiftFromTemplate(templateItem.dataset.templateId);
            }
        });
    };

    // Установка обработчиков для кнопок удаления смен
    const setupShiftHandlers = () => {
        document.querySelectorAll('.remove-shift-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (!isOwner) {
                    showToast('Только создатель календаря может удалять смены', 'warning');
                    return;
                }

                const shiftId = e.target.dataset.shiftId;
                deleteShift(shiftId); // Убрали confirm, можно добавить обратно если нужно
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

    // ====================== ИНИЦИАЛИЗАЦИЯ ======================

    // Скрываем элементы управления для пользователей без прав
    if (!hasEditRights) {
        document.querySelectorAll('.remove-shift-btn, .delete-template-btn').forEach(btn => {
            btn.style.display = 'none';
        });

        if (createTemplateBtn) createTemplateBtn.style.display = 'none';
        if (!isOwner && addMemberBtn) {
            document.querySelector('.add-member-form').style.display = 'none';
        }
    }

    // Инициализация всех обработчиков
    const init = () => {
        updateMonthDisplay();
        setupMonthNavigation();
        setupModals();
        setupTemplateHandlers();
        setupShiftHandlers();
        setupMemberHandlers();
        setupCalendarCellHandlers();
    };

    init();
});