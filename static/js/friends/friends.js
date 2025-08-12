document.addEventListener('DOMContentLoaded', () => {
    // Основные элементы
    const friendsSearch = document.getElementById('friendsSearch');
    const searchClear = document.getElementById('searchClear');
    const noFriendsElement = document.querySelector('.no-friends');
    const friendsGrid = document.querySelector('.friends-grid');

    // Сохраняем оригинальное состояние
    const originalNoFriendsHTML = noFriendsElement ? noFriendsElement.innerHTML : '';
    const friendCards = friendsGrid ? Array.from(friendsGrid.querySelectorAll('.friend-card')) : [];

    // Функция для выполнения поиска
    const performSearch = (searchTerm) => {
        searchTerm = searchTerm.toLowerCase().trim();
        let hasMatches = false;

        // Перебираем все карточки
        friendCards.forEach(card => {
            const username = card.dataset.username.toLowerCase();
            const email = card.dataset.email.toLowerCase();
            const isMatch = username.includes(searchTerm) || email.includes(searchTerm);

            if (searchTerm === '' || isMatch) {
                card.style.display = 'flex';
                if (isMatch) hasMatches = true;
            } else {
                card.style.display = 'none';
            }
        });

        // Управление сообщениями
        if (noFriendsElement) {
            if (searchTerm !== '' && !hasMatches) {
                noFriendsElement.style.display = 'block';
                noFriendsElement.innerHTML = `
                    <div class="no-friends-icon">
                        <i class="bi bi-search"></i>
                    </div>
                    <h3>Ничего не найдено</h3>
                    <p>Попробуйте изменить поисковый запрос</p>
                `;
            } else {
                noFriendsElement.style.display = searchTerm === '' && friendCards.length === 0 ? 'block' : 'none';
                if (searchTerm === '') {
                    noFriendsElement.innerHTML = originalNoFriendsHTML;
                }
            }
        }
    };

    // Инициализация поиска
    if (friendsSearch && searchClear) {
        // Обработка ввода
        friendsSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            searchClear.classList.toggle('visible', searchTerm.length > 0);
            performSearch(searchTerm);
        });

        // Кнопка очистки
        searchClear.addEventListener('click', () => {
            friendsSearch.value = '';
            searchClear.classList.remove('visible');
            performSearch('');
            friendsSearch.focus();
        });

        // Очистка по Escape
        friendsSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                friendsSearch.value = '';
                searchClear.classList.remove('visible');
                performSearch('');
            }
        });
    }

    // Остальной код (управление dropdown и т.д.)
    const addBtn = document.getElementById('addFriendToggle');
    const addForm = document.getElementById('addFriendForm');
    const bell = document.getElementById('toggleRequests');
    const dropdown = document.getElementById('requestsDropdown');

    if (addBtn && addForm) {
        addForm.style.display = 'none';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (bell && dropdown) {
        dropdown.style.display = 'none';
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
    }

    document.addEventListener('click', (e) => {
        if (dropdown && !dropdown.contains(e.target) && bell && !bell.contains(e.target)) {
            dropdown.style.display = 'none';
        }
        if (addForm && !addForm.contains(e.target) && addBtn && !addBtn.contains(e.target)) {
            addForm.style.display = 'none';
        }
    });

    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
});