document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('userSearch');
    const searchResults = document.getElementById('searchResults');
    let debounceTimer;

    // Если элементы поиска отсутствуют (например, на страницах входа/регистрации) — выходим
    if (!searchInput || !searchResults) {
        return;
    }

    function performSearch(query) {
        fetch(`/api/search_users?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(users => {
                if (users.length === 0) {
                    searchResults.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
                } else {
                    searchResults.innerHTML = users.map(user => `
                            <div class="search-result-item" data-user-id="${user.id}" data-username="${user.username}">
                                <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                                    <img src="/static/images/${user.avatar}" 
                                         class="search-result-avatar" 
                                         onerror="this.src='/static/images/default_avatar.svg'">
                                    <div class="search-result-info">
                                        <div class="search-result-name">${user.first_name} ${user.last_name}</div>
                                        <div class="search-result-username">@${user.username}</div>
                                    </div>
                                </div>
                                <div class="search-result-actions">
                                    ${renderActionHTML(user.username, user.is_friend ? 'friends' : (user.request_status || 'none'))}
                                </div>
                            </div>
                        `).join('');
                }
                searchResults.style.display = 'block';
            })
            .catch(error => {
                console.error('Ошибка поиска:', error);
                searchResults.innerHTML = '<div class="no-results text-danger">Ошибка загрузки</div>';
                searchResults.style.display = 'block';
            });
    }

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length < 2) {
            searchResults.innerHTML = '<div class="no-results">Введите минимум 2 символа</div>';
            searchResults.style.display = 'block';
            return;
        }

        debounceTimer = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    // Скрываем результаты при клике вне поля
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Показываем результаты при фокусе, если есть текст
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length > 0) {
            searchResults.style.display = 'block';
        }
    });

    // Экспорт функции обновления статуса элемента поиска по userId
    window.updateSearchResultByUserId = (userId, status) => {
        try {
            const item = searchResults.querySelector(`.search-result-item[data-user-id="${CSS.escape(String(userId))}"]`);
            if (!item) return;
            const actions = item.querySelector('.search-result-actions');
            const username = item.getAttribute('data-username') || (item.querySelector('.search-result-username')?.textContent || '').replace('@','');
            if (!actions) return;
            actions.innerHTML = renderActionHTML(username, status);
        } catch (e) {
            // no-op
        }
    };

    // Экспорт функции обновления текущих результатов (используется пуллингом)
    window.refreshSearchResultsIfOpen = () => {
        const q = searchInput.value.trim();
        if (q.length >= 2) {
            performSearch(q);
        }
    };
});

// Вспомогательная функция генерации HTML для действий по статусу
function renderActionHTML(username, status) {
    switch (status) {
        case 'friends':
            return '<span class="search-result-already-friends"><i class="bi bi-check-circle"></i> В друзьях</span>';
        case 'outgoing_pending':
            return '<span class="search-result-already-friends"><i class="bi bi-hourglass-split"></i> Запрос отправлен</span>';
        case 'incoming_pending':
            return '<span class="search-result-already-friends"><i class="bi bi-inbox"></i> Ожидает вашего ответа</span>';
        case 'none':
        default:
            return `
                <form method="POST" action="/friends/add" style="display: inline;">
                    <input type="hidden" name="username" value="${username}">
                    <button type="submit" class="btn btn-sm btn-primary" style="padding: 0.25rem 0.75rem;">
                        <i class="bi bi-person-plus"></i> Добавить
                    </button>
                </form>`;
    }
}