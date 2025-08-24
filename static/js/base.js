document.addEventListener('DOMContentLoaded', function () {
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const toggleAddFriendBtn = document.getElementById('toggleAddFriendBtn');
    const addFriendForm = document.getElementById('addFriendForm');
    const bellToggle = document.getElementById('bellToggle');
    const bellDropdown = document.getElementById('bellDropdown');
    const bellClose = document.getElementById('bellClose');


    // Меню бургера
    if (hamburger && sidebar && overlay) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            hamburger.classList.toggle('active');
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
        });

        overlay.addEventListener('click', () => {
            hamburger.classList.remove('active');
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });

        // Закрытие при клике вне сайдбара
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
                hamburger.classList.remove('active');
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Кнопка "Добавить друга"
    if (toggleAddFriendBtn && addFriendForm) {
        toggleAddFriendBtn.addEventListener('click', () => {
            const isVisible = addFriendForm.style.display === 'flex';
            addFriendForm.style.display = isVisible ? 'none' : 'flex';
        });
    }

    // Колокольчик
    if (bellToggle && bellDropdown) {
        // Открыть/закрыть по клику
        bellToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            bellDropdown.classList.toggle('active');
        });

        // Закрыть при клике вне
        document.addEventListener('click', (e) => {
            if (!bellDropdown.contains(e.target) && !bellToggle.contains(e.target)) {
                bellDropdown.classList.remove('active');
            }
        });

        // Кнопка закрытия в шапке дропдауна (делегировано, работает и для пересобранного содержимого)
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'bellClose') {
                e.stopPropagation();
                bellDropdown.classList.remove('active');
            }
        });
    }

    initFlashMessages();
    setupToastCloseHandlers();
    setupRegistrationFormValidation();
    setupFriendAjaxHandlers();
    startFriendRequestsPolling();
});

// === Toast уведомления ===
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

        void toast.offsetWidth; // reflow
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

// Flash сообщения от Jinja2
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

// === Валидация формы регистрации ===
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

// === Динамика заявок/добавления друзей ===
function setupFriendAjaxHandlers() {
    // Делегирование submit для форм внутри результатов поиска (Добавить в друзья)
    document.addEventListener('submit', async function (e) {
        const form = e.target;
        // /friends/add из поиска в шапке
        if (form.matches('#searchResults form[action="/friends/add"], #searchResults form[action*="/friends/add"]')) {
            e.preventDefault();
            await handleAddFriendForm(form, e.submitter);
        }

        // Обработка принятия/отклонения заявок в колокольчике
        if (form.matches('#bellDropdown form[action*="/friends/requests"]')) {
            e.preventDefault();
            await handleFriendRequestForm(form, e.submitter);
        }
    });
}

async function handleAddFriendForm(form, submitter) {
    try {
        const fd = new FormData(form);
        if (submitter && submitter.name) fd.set(submitter.name, submitter.value);
        const actionUrl = form.getAttribute('action') || '/friends/add';
        const res = await fetch(actionUrl, {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: fd
        });
        const data = await res.json();

        const actions = form.closest('.search-result-actions');
        if (!res.ok || !data.success) {
            toastManager.show(data.message || 'Не удалось отправить запрос', 'danger');
            return;
        }

        // Обновление UI
        if (data.status === 'sent' || data.status === 'already_sent') {
            if (actions) actions.innerHTML = '<span class="search-result-already-friends"><i class="bi bi-hourglass-split"></i> Запрос отправлен</span>';
            toastManager.show(data.message || 'Запрос отправлен', 'success');
        } else if (data.status === 'already_friends') {
            if (actions) actions.innerHTML = '<span class="search-result-already-friends"><i class="bi bi-check-circle"></i> В друзьях</span>';
            toastManager.show(data.message || 'Пользователь уже в друзьях', 'success');
        } else {
            toastManager.show(data.message || 'Готово', 'success');
        }
    } catch (err) {
        console.error(err);
        toastManager.show('Ошибка сети', 'danger');
    }
}

async function handleFriendRequestForm(form, submitter) {
    try {
        const fd = new FormData(form);
        if (submitter && submitter.name) fd.set(submitter.name, submitter.value);
        // Убедимся, что action присутствует
        const actionUrl = form.getAttribute('action') || '/friends/requests';
        const res = await fetch(actionUrl, {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: fd
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            toastManager.show(data.message || 'Не удалось выполнить операцию', 'danger');
            return;
        }

        // Удаляем уведомление из списка
        const item = form.closest('.notification-item');
        if (item) item.remove();

        // Обновляем бейдж
        const badge = document.querySelector('.bell-badge');
        if (badge) {
            const n = Math.max(0, (parseInt(badge.textContent, 10) || 1) - 1);
            if (n > 0) {
                badge.textContent = String(n);
            } else {
                badge.remove();
            }
        }

        // Если больше нет уведомлений — показать заглушку
        const anyLeft = document.querySelectorAll('#bellDropdown .notification-item').length > 0;
        if (!anyLeft) {
            const container = document.getElementById('bellDropdown');
            if (container) {
                container.innerHTML = `
                    <div class="dropdown-header">
                        <span class="dropdown-title">Заявки в друзья</span>
                        <button class="dropdown-close" id="bellClose">&times;</button>
                    </div>
                    <div class="no-notifications">
                        <i class="bi bi-bell-slash" style="font-size: 1.5rem;"></i>
                        <p style="margin-top: 0.5rem;">Нет новых уведомлений</p>
                    </div>`;
            }
        }

        // Тост
        toastManager.show(data.message || (data.status === 'accepted' ? 'Принято' : 'Отклонено'), 'success');

        // Обновление списка коллег (если принято)
        if (data.status === 'accepted' && data.sender) {
            addFriendCardToGrid(data.sender);
            updateFriendsCountBadge(typeof data.friends_count === 'number' ? data.friends_count : null);
            // В поиске — показать, что теперь в друзьях
            if (window.updateSearchResultByUserId) {
                window.updateSearchResultByUserId(String(data.sender.id), 'friends');
            } else {
                simpleUpdateSearchResult(String(data.sender.id), 'friends');
            }
        }

        // Если отклонено — в поиске кнопка должна стать «Добавить»
        if (data.status === 'rejected' && data.sender) {
            if (window.updateSearchResultByUserId) {
                window.updateSearchResultByUserId(String(data.sender.id), 'none');
            } else {
                simpleUpdateSearchResult(String(data.sender.id), 'none');
            }
        }
    } catch (err) {
        console.error(err);
        toastManager.show('Ошибка сети', 'danger');
    }
}

// === Помощники для друзей/поиска ===
function addFriendCardToGrid(friend) {
    const grid = document.querySelector('.friends-grid');
    if (!grid || !friend) return;

    // Скрыть заглушку
    const noFriendsBlocks = grid.querySelectorAll('.no-friends');
    noFriendsBlocks.forEach(el => el.style.display = 'none');

    // Проверить, нет ли уже карточки
    if (grid.querySelector(`.friend-card[data-username="${(friend.username || '').toLowerCase()}"]`)) return;

    const card = document.createElement('div');
    card.className = 'friend-card';
    card.setAttribute('data-username', (friend.username || '').toLowerCase());
    card.setAttribute('data-email', (friend.email || ''));
    card.setAttribute('data-first-name', (friend.first_name || '').toLowerCase());
    card.setAttribute('data-last-name', (friend.last_name || '').toLowerCase());
    const since = friend.created_at ? new Date(friend.created_at) : null;

    card.innerHTML = `
        <div class="friend-avatar">
            <img src="/static/images/${friend.avatar}" onerror="this.src='/static/images/default_avatar.svg'" alt="${friend.username}">
        </div>
        <div class="friend-info">
            <h3 class="friend-name">${friend.first_name || ''} ${friend.last_name || ''}</h3>
            <p class="friend-email">@${friend.username}</p>
            <div class="friend-meta">
                <span class="friend-since">
                    <i class="bi bi-calendar"></i>
                    ${since ? `С ${pad2(since.getDate())}.${pad2(since.getMonth()+1)}.${since.getFullYear()}` : ''}
                </span>
            </div>
        </div>
        <div class="friend-actions">
            <form action="/friends/delete/${friend.id}" method="POST">
                <button type="submit" class="btn btn-danger btn-sm" title="Удалить из коллег">
                    <i class="bi bi-person-dash"></i>
                </button>
            </form>
        </div>`;
    grid.prepend(card);
}

function pad2(n) { return String(n).padStart(2, '0'); }

function updateFriendsCountBadge(count) {
    if (typeof count !== 'number') return;
    const el = document.querySelector('.friends-count');
    if (!el) return;
    el.textContent = `${count} ${pluralizeRu(count, ['коллега','коллеги','коллег'])}`;
}

function pluralizeRu(n, forms) {
    // forms: [one, few, many]
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
}

function simpleUpdateSearchResult(userId, status) {
    const item = document.querySelector(`#searchResults .search-result-item[data-user-id="${CSS.escape(userId)}"]`);
    if (!item) return;
    const actions = item.querySelector('.search-result-actions');
    const username = item.getAttribute('data-username') || (item.querySelector('.search-result-username')?.textContent || '').replace('@','').trim();
    if (!actions) return;

    if (status === 'friends') {
        actions.innerHTML = '<span class="search-result-already-friends"><i class="bi bi-check-circle"></i> В друзьях</span>';
    } else if (status === 'none') {
        actions.innerHTML = `
            <form method="POST" action="/friends/add" style="display: inline;">
                <input type="hidden" name="username" value="${username}">
                <button type="submit" class="btn btn-sm btn-primary" style="padding: 0.25rem 0.75rem;">
                    <i class="bi bi-person-plus"></i> Добавить
                </button>
            </form>`;
    }
}

// === Пуллинг заявок в друзья ===
function startFriendRequestsPolling() {
    // Пулим только если видим колокольчик
    if (!document.getElementById('bellDropdown')) return;
    const poll = async () => {
        try {
            const res = await fetch('/api/friend_requests', { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            renderFriendRequestsDropdown(data);
            updateBellBadge(data.count || 0);
            // Обновляем результаты поиска, если открыт и есть запрос
            if (window.refreshSearchResultsIfOpen) {
                window.refreshSearchResultsIfOpen();
            }
        } catch (e) {
            // Тихо игнорируем ошибки опроса
        }
    };
    poll();
    setInterval(poll, 20000); // каждые 20 сек
}

function renderFriendRequestsDropdown(data) {
    const container = document.getElementById('bellDropdown');
    if (!container) return;
    const items = Array.isArray(data.items) ? data.items : [];

    const header = `
        <div class="dropdown-header">
            <span class="dropdown-title">Заявки в друзья</span>
            <button class="dropdown-close" id="bellClose">&times;</button>
        </div>`;

    if (items.length === 0) {
        container.innerHTML = header + `
            <div class="no-notifications">
                <i class="bi bi-bell-slash" style="font-size: 1.5rem;"></i>
                <p style="margin-top: 0.5rem;">Нет новых уведомлений</p>
            </div>`;
        return;
    }

    const listHtml = items.map(it => `
        <div class="notification-item unread">
            <div class="notification-content">
                <img src="/static/images/${it.sender.avatar}" class="notification-avatar" onerror="this.src='/static/images/default_avatar.svg'">
                <div class="notification-text">
                    <div class="notification-name">${it.sender.first_name || ''} ${it.sender.last_name || ''}</div>
                    <div class="notification-username">@${it.sender.username}</div>
                    <div class="notification-actions" style="margin-top: 0.5rem;">
                        <form method="POST" action="/friends/requests">
                            <input type="hidden" name="request_id" value="${it.id}">
                            <button name="action" value="accept" class="notification-btn notification-btn-accept">
                                <i class="bi bi-check-lg"></i> Принять
                            </button>
                            <button name="action" value="reject" class="notification-btn notification-btn-reject">
                                <i class="bi bi-x-lg"></i> Отклонить
                            </button>
                        </form>
                    </div>
                    <div class="notification-meta">
                        <span class="notification-time">${formatRequestTime(it.timestamp)}</span>
                    </div>
                </div>
            </div>
        </div>`).join('');

    container.innerHTML = header + listHtml;
}

function formatRequestTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function updateBellBadge(count) {
    const toggle = document.getElementById('bellToggle');
    if (!toggle) return;
    let badge = toggle.querySelector('.bell-badge');
    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'bell-badge';
            toggle.appendChild(badge);
        }
        badge.textContent = String(count);
    } else if (badge) {
        badge.remove();
    }
}
