document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeModal();
    initializeDeleteButtons();
});

// Инициализация табов
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Убираем активные классы у всех кнопок и контента
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Добавляем активные классы к выбранной кнопке и контенту
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Инициализация модального окна
function initializeModal() {
    const modal = document.getElementById('deleteModal');
    
    // Закрытие модального окна при клике вне его
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDeleteModal();
        }
    });
    
    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeDeleteModal();
        }
    });
}

// Инициализация кнопок удаления
function initializeDeleteButtons() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) {
            const button = e.target.closest('.delete-btn');
            const calendarId = button.getAttribute('data-calendar-id');
            const calendarName = button.getAttribute('data-calendar-name');
            const event = e;
            
            deleteCalendar(calendarId, calendarName, event);
        }
    });
}

let currentCalendarId = null;
let currentCalendarElement = null;

// Открытие модального окна для удаления
function deleteCalendar(calendarId, calendarName, event) {
    currentCalendarId = parseInt(calendarId);
    currentCalendarElement = event.target.closest('.calendar-card');
    document.getElementById('calendarNameToDelete').textContent = calendarName;
    document.getElementById('deleteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Закрытие модального окна
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    document.body.style.overflow = '';
    currentCalendarId = null;
    currentCalendarElement = null;
}

// Подтверждение удаления с AJAX запросом
async function confirmDelete() {
    if (!currentCalendarId) return;

    try {
        const response = await fetch(`/calendar/${currentCalendarId}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await response.json();

        if (data.success) {
            // Удаляем элемент из DOM
            if (currentCalendarElement) {
                currentCalendarElement.remove();
                
                // Проверяем, есть ли еще календари в текущей вкладке
                const activeTab = document.querySelector('.tab-content.active');
                const remainingCards = activeTab.querySelectorAll('.calendar-card');
                
                if (remainingCards.length === 0) {
                    // Показываем сообщение о том, что календарей нет
                    const tabId = activeTab.id.replace('-tab', '');
                    showNoCalendarsMessage(activeTab, tabId);
                }
            }
            
            // Показываем уведомление об успешном удалении
            showNotification('Календарь успешно удален', 'success');
        } else {
            showNotification(data.error || 'Ошибка при удалении календаря', 'error');
        }
    } catch (error) {
        console.error('Error deleting calendar:', error);
        showNotification('Ошибка при удалении календаря', 'error');
    }

    closeDeleteModal();
}

// Показать сообщение о том, что календарей нет
function showNoCalendarsMessage(tabElement, tabType) {
    const messages = {
        'personal': {
            icon: 'bi-calendar-x',
            title: 'Нет личных календарей',
            description: 'Создайте личный календарь для управления своими сменами'
        },
        'team': {
            icon: 'bi-calendar-x',
            title: 'Нет командных календарей',
            description: 'Создайте командный календарь для управления сменами ваших коллег'
        },
        'shared': {
            icon: 'bi-calendar-x',
            title: 'Нет общих календарей',
            description: 'Здесь будут отображаться календари, которыми с вами поделились'
        }
    };

    const message = messages[tabType];
    if (message) {
        tabElement.innerHTML = `
            <div class="no-calendars">
                <i class="bi ${message.icon}"></i>
                <h3>${message.title}</h3>
                <p>${message.description}</p>
            </div>
        `;
    }
}

// Показать уведомление используя стандартный toastManager
function showNotification(message, type) {
    // Используем стандартный toastManager из base.js
    if (typeof toastManager !== 'undefined') {
        toastManager.show(message, type, 3000);
    } else {
        // Fallback для случая, если toastManager недоступен
        console.warn('toastManager not available, using fallback notification');
        const notification = document.createElement('div');
        notification.className = `toast toast-${type}`;
        notification.innerHTML = `
            <div>${message}</div>
            <button type="button" class="toast-close">&times;</button>
        `;
        
        const container = document.querySelector('.toast-container') || document.body;
        container.appendChild(notification);
        
        // Показываем уведомление
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Автоматически удаляем через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}
