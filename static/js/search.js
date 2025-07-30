document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('userSearch');
    const searchResults = document.getElementById('searchResults');
    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length < 2) {
            searchResults.innerHTML = '<div class="no-results">Введите минимум 2 символа</div>';
            searchResults.style.display = 'block';
            return;
        }

        debounceTimer = setTimeout(() => {
            fetch(`/api/search_users?q=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(users => {
                    if (users.length === 0) {
                        searchResults.innerHTML = '<div class="no-results">Пользователи не найдены</div>';
                    } else {
                        searchResults.innerHTML = users.map(user => `
                            <div class="search-result-item" data-user-id="${user.id}">
                                <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
                                    <img src="/static/images/${user.avatar}" 
                                         class="search-result-avatar" 
                                         onerror="this.src='/static/images/default_avatar.svg'">
                                    <div class="search-result-info">
                                        <div class="search-result-username">${user.username}</div>
                                    </div>
                                </div>
                                <div class="search-result-actions">
                                    ${user.is_friend ? 
                                        '<span class="search-result-already-friends"><i class="bi bi-check-circle"></i> В друзьях</span>' : 
                                        `<form method="POST" action="/friends/add" style="display: inline;">
                                            <input type="hidden" name="username" value="${user.username}">
                                            <button type="submit" class="btn btn-sm btn-primary" 
                                                    style="padding: 0.25rem 0.75rem;">
                                                <i class="bi bi-person-plus"></i> Добавить
                                            </button>
                                        </form>`}
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
});