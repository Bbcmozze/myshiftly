document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (hamburger && sidebar && overlay) {
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    initFlashMessages();
    setupToastCloseHandlers();
    setupRegistrationFormValidation();
});

// Toast уведомления
const toastManager = {
    toasts: new Set(),

    createContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    getContainer() {
        return document.querySelector('.toast-container') || this.createContainer();
    },

    show(message, type = 'success', timeout = 2000) {
        const container = this.getContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        toast.innerHTML = `
            <div>${message}</div>
            <button type="button" class="toast-close">&times;</button>
        `;

        container.appendChild(toast);
        this.toasts.add(toast);

        // Принудительный reflow для анимации
        void toast.offsetWidth;
        toast.classList.add('show');

        if (timeout > 0) {
            toast._timer = setTimeout(() => {
                this.dismiss(toast);
            }, timeout);
        }

        return toast;
    },

    dismiss(toast) {
        if (!toast || !this.toasts.has(toast)) return;

        clearTimeout(toast._timer);
        toast.classList.remove('show');
        toast.classList.add('hide');

        toast.addEventListener('transitionend', () => {
            toast.remove();
            this.toasts.delete(toast);
        }, { once: true });
    }
};

// Перехват flash-сообщений от Jinja2
function initFlashMessages() {
    const flashMessages = document.querySelectorAll('.alert');
    flashMessages.forEach(message => {
        const type = message.classList.contains('alert-success') ? 'success' : 'danger';
        toastManager.show(message.textContent.trim(), type, 2000);
        message.remove();
    });
}

function setupToastCloseHandlers() {
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('toast-close')) {
            const toast = e.target.closest('.toast');
            toastManager.dismiss(toast);
        }
    });
}

// Валидация формы регистрации
function setupRegistrationFormValidation() {
    const registerForm = document.querySelector('form[action*="register"]');
    if (!registerForm) return;

    registerForm.addEventListener('submit', function (e) {
        if (!validateRegistrationForm()) {
            e.preventDefault();
        }
    });

    const passwordInput = document.getElementById('password');
    const passwordRequirements = document.querySelector('.password-requirements');

    if (passwordInput && passwordRequirements) {
        passwordInput.addEventListener('input', function () {
            updatePasswordStrengthIndicator(this.value, passwordRequirements);
        });
        updatePasswordStrengthIndicator(passwordInput.value, passwordRequirements);
    }
}

function validateRegistrationForm() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;

    if (password.length < 8) {
        toastManager.show('Пароль должен содержать не менее 8 символов', 'danger');
        return false;
    }

    if (password !== confirmPassword) {
        toastManager.show('Пароли не совпадают', 'danger');
        return false;
    }

    return true;
}

function updatePasswordStrengthIndicator(password, requirementsElement) {
    if (password.length === 0) {
        requirementsElement.style.color = '#6b7280';
        requirementsElement.textContent = 'Пароль должен содержать не менее 8 символов';
    } else if (password.length < 8) {
        requirementsElement.style.color = '#dc2626';
        requirementsElement.textContent = 'Пароль слишком короткий (минимум 8 символов)';
    } else {
        requirementsElement.style.color = '#16a34a';
        requirementsElement.textContent = 'Пароль соответствует требованиям';
    }
}
