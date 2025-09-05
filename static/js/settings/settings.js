// Базовая интерактивность для страницы настроек (без функционала сохранения)

document.addEventListener('DOMContentLoaded', function() {
    // Инициализация всех интерактивных элементов
    initializeTabNavigation();
    initializeThemeSelector();
    initializeColorSelector();
    initializeToggleSwitches();
    initializeQuietHours();
    initializeSecurity();
    initializeFormActions();
    
    // Добавляем анимации при загрузке
    animateSettingsSections();
});

// Навигация по табам
function initializeTabNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Убираем активный класс со всех табов
            navTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Добавляем активный класс к выбранному табу
            this.classList.add('active');
            const targetContent = document.getElementById(targetTab + '-tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            // Анимация переключения
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 100);
            
            // Сохраняем выбранный таб в localStorage
            localStorage.setItem('activeSettingsTab', targetTab);
            
            console.log('Переключен на таб:', targetTab);
        });
    });
    
    // Восстанавливаем последний активный таб
    const savedTab = localStorage.getItem('activeSettingsTab');
    if (savedTab) {
        const savedTabButton = document.querySelector(`[data-tab="${savedTab}"]`);
        const savedTabContent = document.getElementById(savedTab + '-tab');
        
        if (savedTabButton && savedTabContent) {
            // Убираем активные классы
            navTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Активируем сохраненный таб
            savedTabButton.classList.add('active');
            savedTabContent.classList.add('active');
        }
    }
}

// Селектор тем
function initializeThemeSelector() {
    const themeOptions = document.querySelectorAll('input[name="theme"]');
    
    themeOptions.forEach(option => {
        option.addEventListener('change', function() {
            // Визуальная обратная связь при выборе темы
            const preview = this.nextElementSibling;
            preview.style.transform = 'scale(1.05)';
            setTimeout(() => {
                preview.style.transform = 'scale(1)';
            }, 200);
            
            // Здесь будет логика применения темы
            showToast(`Выбрана тема: ${this.value === 'light' ? 'Светлая' : this.value === 'dark' ? 'Темная' : 'Автоматическая'}`, 'success', 2000);
            console.log('Выбрана тема:', this.value);
        });
    });
}

// Селектор цветов
function initializeColorSelector() {
    const colorOptions = document.querySelectorAll('input[name="accent-color"]');
    
    colorOptions.forEach(option => {
        option.addEventListener('change', function() {
            // Анимация при выборе цвета
            const preview = this.nextElementSibling;
            preview.style.transform = 'scale(1.2)';
            setTimeout(() => {
                preview.style.transform = 'scale(1.1)';
            }, 200);
            
            // Здесь будет логика применения цветовой схемы
            const colorNames = {
                'blue': 'Синий',
                'green': 'Зеленый', 
                'purple': 'Фиолетовый',
                'orange': 'Оранжевый'
            };
            showToast(`Выбран акцентный цвет: ${colorNames[this.value] || this.value}`, 'success', 2000);
            console.log('Выбран цвет:', this.value);
        });
    });
}

// Toggle переключатели
function initializeToggleSwitches() {
    const toggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');
    
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            const slider = this.nextElementSibling;
            
            // Добавляем небольшую анимацию
            slider.style.transform = 'scale(0.95)';
            setTimeout(() => {
                slider.style.transform = 'scale(1)';
            }, 100);
            
            const settingNames = {
                'animations': 'Анимации',
                'browser-push': 'Push-уведомления',
                'sound-alerts': 'Звуковые сигналы',
                'quiet-hours': 'Тихие часы'
            };
            const settingName = settingNames[this.name] || this.name;
            showToast(`${settingName} ${this.checked ? 'включены' : 'отключены'}`, 'success', 1500);
            console.log(`${this.name}: ${this.checked ? 'включено' : 'отключено'}`);
        });
    });
}

// Тихие часы
function initializeQuietHours() {
    const quietHoursToggle = document.querySelector('input[name="quiet-hours"]');
    const timeInputs = document.querySelector('.time-inputs');
    
    if (quietHoursToggle && timeInputs) {
        // Изначально скрываем поля времени если toggle выключен
        if (!quietHoursToggle.checked) {
            timeInputs.style.opacity = '0.5';
            timeInputs.style.pointerEvents = 'none';
        }
        
        quietHoursToggle.addEventListener('change', function() {
            if (this.checked) {
                timeInputs.style.opacity = '1';
                timeInputs.style.pointerEvents = 'auto';
                timeInputs.style.transition = 'opacity 0.3s ease';
            } else {
                timeInputs.style.opacity = '0.5';
                timeInputs.style.pointerEvents = 'none';
                timeInputs.style.transition = 'opacity 0.3s ease';
            }
        });
    }
}

// Безопасность
function initializeSecurity() {
    const setupBtn = document.querySelector('.setup-btn');
    const authMethods = document.querySelector('.auth-methods');
    
    if (setupBtn && authMethods) {
        setupBtn.addEventListener('click', function() {
            if (authMethods.style.display === 'none' || !authMethods.style.display) {
                authMethods.style.display = 'block';
                authMethods.style.animation = 'slideDown 0.3s ease';
                this.textContent = 'Отменить';
                this.style.background = '#e74c3c';
            } else {
                authMethods.style.display = 'none';
                this.textContent = 'Настроить';
                this.style.background = '#3498db';
            }
        });
    }
    
    // Кнопки действий безопасности
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Анимация клика
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 100);
            
            // Заглушка для демонстрации
            if (this.classList.contains('danger')) {
                showConfirmDialog('Вы уверены, что хотите удалить аккаунт?');
            } else {
                showToast(`Функция "${this.textContent.trim()}" будет доступна в следующих версиях`, 'info');
            }
        });
    });
}

// Действия с формой
function initializeFormActions() {
    const saveBtn = document.getElementById('saveSettings');
    const resetBtn = document.getElementById('resetSettings');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            // Анимация сохранения
            this.style.transform = 'scale(0.95)';
            this.innerHTML = '<i class="bi bi-hourglass-split"></i> Сохранение...';
            
            setTimeout(() => {
                this.style.transform = 'scale(1)';
                this.innerHTML = '<i class="bi bi-check-lg"></i> Сохранено!';
                this.style.background = '#27ae60';
                
                setTimeout(() => {
                    this.innerHTML = '<i class="bi bi-check-lg"></i> Сохранить изменения';
                    this.style.background = '';
                }, 2000);
            }, 1000);

            // Сохраняем настройки всех табов
            saveAllTabSettings();
            showToast('Настройки успешно сохранены!', 'success');
            console.log('Сохранение настроек...');
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            if (confirm('Вы уверены, что хотите сбросить все настройки?')) {
                // Анимация сброса
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 100);

                // Сброс настроек всех табов
                resetAllSettings();
                showToast('Настройки сброшены к значениям по умолчанию', 'success');
            }
        });
    }
}

// Сохранение настроек всех табов
function saveAllTabSettings() {
    const settings = {
        // Внешний вид
        theme: document.querySelector('input[name="theme"]:checked')?.value || 'light',
        accentColor: document.querySelector('input[name="accent-color"]:checked')?.value || 'blue',
        fontSize: document.querySelector('select[name="font-size"]')?.value || 'medium',
        density: document.querySelector('select[name="density"]')?.value || 'normal',
        animations: document.querySelector('input[name="animations"]')?.checked || true,

        // Локализация
        timezone: document.querySelector('select[name="timezone"]')?.value || 'Europe/Moscow',
        timeFormat: document.querySelector('input[name="time-format"]:checked')?.value || '24h',
        dateFormat: document.querySelector('select[name="date-format"]')?.value || 'dd.mm.yyyy',
        weekStart: document.querySelector('input[name="week-start"]:checked')?.value || 'monday',

        // Уведомления
        emailNewShifts: document.querySelector('input[name="email-new-shifts"]')?.checked || false,
        emailChanges: document.querySelector('input[name="email-changes"]')?.checked || false,
        emailReminders: document.querySelector('input[name="email-reminders"]')?.checked || false,
        browserPush: document.querySelector('input[name="browser-push"]')?.checked || false,
        soundAlerts: document.querySelector('input[name="sound-alerts"]')?.checked || false,
        quietHours: document.querySelector('input[name="quiet-hours"]')?.checked || false,
        quietStart: document.querySelector('input[name="quiet-start"]')?.value || '22:00',
        quietEnd: document.querySelector('input[name="quiet-end"]')?.value || '08:00',

        // Безопасность
        autoLogout: document.querySelector('select[name="auto-logout"]')?.value || 'never',
        profileVisibility: document.querySelector('select[name="profile-visibility"]')?.value || 'friends',
        statsVisibility: document.querySelector('select[name="stats-visibility"]')?.value || 'friends'
    };

    // Сохраняем в localStorage для демонстрации
    localStorage.setItem('userSettings', JSON.stringify(settings));
    console.log('Настройки сохранены:', settings);
}

// Сброс всех настроек к значениям по умолчанию
function resetAllSettings() {
    // Тема
    document.querySelector('input[name="theme"][value="light"]').checked = true;

    // Цвет
    document.querySelector('input[name="accent-color"][value="blue"]').checked = true;
    
    // Размер шрифта
    document.querySelector('select[name="font-size"]').value = 'medium';
    
    // Плотность
    document.querySelector('select[name="density"]').value = 'normal';
    
    // Анимации
    document.querySelector('input[name="animations"]').checked = true;
    
    // Часовой пояс
    document.querySelector('select[name="timezone"]').value = 'Europe/Moscow';
    
    // Формат времени
    document.querySelector('input[name="time-format"][value="24h"]').checked = true;
    
    // Формат даты
    document.querySelector('select[name="date-format"]').value = 'dd.mm.yyyy';
    
    // Первый день недели
    document.querySelector('input[name="week-start"][value="monday"]').checked = true;
    
    // Сброс всех чекбоксов уведомлений
    const notificationCheckboxes = document.querySelectorAll('input[type="checkbox"][name*="email"], input[type="checkbox"][name*="remind"], input[type="checkbox"][name*="friend"]');
    notificationCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Включаем некоторые уведомления по умолчанию
    const defaultNotifications = ['email-new-shifts', 'email-changes', 'sound-alerts', 'remind-1h', 'friend-requests'];
    defaultNotifications.forEach(name => {
        const checkbox = document.querySelector(`input[name="${name}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    // Сброс настроек безопасности
    document.querySelector('select[name="auto-logout"]').value = 'never';
    document.querySelector('select[name="profile-visibility"]').value = 'friends';
    document.querySelector('select[name="stats-visibility"]').value = 'friends';
    
    // Тихие часы
    document.querySelector('input[name="quiet-hours"]').checked = false;
    initializeQuietHours(); // Переинициализируем
}

// Анимация секций при загрузке
function animateSettingsSections() {
    // Анимируем навигационные табы
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach((tab, index) => {
        tab.style.opacity = '0';
        tab.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            tab.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            tab.style.opacity = '1';
            tab.style.transform = 'translateY(0)';
        }, index * 50);
    });
    
    // Анимируем активный контент
    setTimeout(() => {
        const activeContent = document.querySelector('.tab-content.active .settings-section');
        if (activeContent) {
            activeContent.style.opacity = '0';
            activeContent.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                activeContent.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                activeContent.style.opacity = '1';
                activeContent.style.transform = 'translateY(0)';
            }, 200);
        }
    }, 300);
}

// Функции для Toast уведомлений (используем стандартную систему из base.js)
function showToast(message, type = 'success', timeout = 3000) {
    if (window.toastManager) {
        return window.toastManager.show(message, type, timeout);
    } else {
        // Fallback если toastManager не загружен
        console.log(`Toast ${type}: ${message}`);
        alert(message);
    }
}

function showConfirmDialog(message) {
    const result = confirm(message);
    if (result) {
        showToast('Функция удаления аккаунта будет доступна в следующих версиях', 'info');
    }
    return result;
}

// Загрузка сохраненных настроек
function loadSavedSettings() {
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            
            // Применяем сохраненные настройки
            if (settings.theme) {
                const themeInput = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
                if (themeInput) themeInput.checked = true;
            }
            
            if (settings.accentColor) {
                const colorInput = document.querySelector(`input[name="accent-color"][value="${settings.accentColor}"]`);
                if (colorInput) colorInput.checked = true;
            }
            
            // Применяем остальные настройки...
            console.log('Настройки загружены:', settings);
        } catch (e) {
            console.error('Ошибка загрузки настроек:', e);
        }
    }
}

// Вызываем загрузку настроек при инициализации
setTimeout(loadSavedSettings, 100);

// CSS анимации (добавляем динамически)
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);
