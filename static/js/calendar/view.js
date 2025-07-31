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
            confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
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
        confirmDeleteBtn
    } = initElements();

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

    // Русские названия месяцев
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                       "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

    // Текущий месяц и год
    let currentMonth = new Date(document.body.dataset.currentMonth);
    let selectedDate = null;
    let selectedUserId = null;
    let currentTemplateId = null;

    // Обновление отображения месяца
    const updateMonthDisplay = () => {
        const monthName = monthNames[currentMonth.getMonth()];
        currentMonthEl.textContent = `${monthName} ${currentMonth.getFullYear()}`;

        const url = new URL(window.location.href);
        url.searchParams.set('month', currentMonth.toISOString().split('T')[0]);
        window.history.pushState({}, '', url);
    };

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
        const modalCloseBtns = document.querySelectorAll('.modal-close');
        const closeAllModals = () => {
            [templateModal, selectTemplateModal, confirmDeleteModal].forEach(modal => {
                modal.style.display = 'none';
            });
        };

        modalCloseBtns.forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });

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
    const createTemplate = (title, start, end) => {
        fetch('/api/create_shift_template', {
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
        })
        .then(response => response.json())
        .then(data => {
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
        })
        .catch(error => {
            handleError(error, 'Ошибка при создании шаблона');
        });
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
    const deleteTemplate = (templateId) => {
        fetch(`/api/delete_shift_template/${templateId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                removeTemplateFromDOM(templateId);
                showToast('Шаблон успешно удален', 'success');
            } else {
                showToast(data.error || 'Ошибка при удалении шаблона', 'danger');
            }
        })
        .catch(error => {
            handleError(error, 'Ошибка при удалении шаблона');
        });
    };

    // Удаление шаблона из DOM
    const removeTemplateFromDOM = (templateId) => {
        document.querySelectorAll(`[data-template-id="${templateId}"]`).forEach(el => {
            el.classList.add('fade-out');
            setTimeout(() => el.remove(), 300);
        });
    };

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

    // Добавление смены из шаблона
    const addShiftFromTemplate = (templateId) => {
        fetch('/api/add_shift_from_template', {
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
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Смена успешно добавлена', 'success');
                location.reload();
            } else {
                showToast(data.error || 'Ошибка при добавлении смены', 'danger');
            }
        })
        .catch(error => {
            handleError(error, 'Ошибка при добавлении смены');
        });
    };

    // Удаление смены
    const setupShiftHandlers = () => {
        document.querySelectorAll('.remove-shift-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();

                if (!hasEditRights) return;

                const shiftId = e.target.dataset.shiftId;
                if (confirm('Удалить эту смену?')) {
                    deleteShift(shiftId);
                }
            });
        });
    };

    const deleteShift = (shiftId) => {
        fetch(`/shift/${shiftId}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        })
        .then(response => {
            if (response.ok) {
                showToast('Смена успешно удалена', 'success');
                location.reload();
            } else {
                showToast('Ошибка при удалении смены', 'danger');
            }
        })
        .catch(error => {
            handleError(error, 'Ошибка при удалении смены');
        });
    };

    // Добавление участников (только для владельца)
    const setupMemberHandlers = () => {
        if (isOwner && addMemberBtn) {
            addMemberBtn.addEventListener('click', () => {
                const userId = friendSelect.value;

                if (!userId) {
                    showToast('Выберите коллегу', 'danger');
                    return;
                }

                const formData = new FormData();
                formData.append('user_id', userId);

                fetch(`/calendar/${document.body.dataset.calendarId}/add-member`, {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showToast('Участник успешно добавлен', 'success');
                        location.reload();
                    } else {
                        showToast(data.error || 'Ошибка при добавлении участника', 'danger');
                    }
                })
                .catch(error => {
                    handleError(error, 'Ошибка при добавлении участника');
                });
            });
        }
    };

    // Обработка кликов по ячейкам календаря
    const setupCalendarCellHandlers = () => {
        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.remove-shift-btn') || e.target.closest('.shift-badge')) return;

                if (!hasEditRights) return;

                selectedDate = cell.dataset.date;
                selectedUserId = cell.dataset.userId;

                if (!cell.classList.contains('has-shift')) {
                    selectTemplateModal.style.display = 'flex';
                }
            });
        });
    };

    // Вспомогательные функции
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div>${message}</div>
            <button type="button" class="toast-close">&times;</button>
        `;

        document.querySelector('.toast-container').appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    const handleError = (error, message = 'Произошла ошибка') => {
        console.error(message, error);
        showToast(message, 'danger');
    };

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