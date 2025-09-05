document.addEventListener('DOMContentLoaded', () => {
    // Основные элементы
    const friendsSearch = document.getElementById('friendsSearch');
    const searchClear = document.getElementById('searchClear');
    const noFriendsElement = document.querySelector('.no-friends');
    const friendsGrid = document.querySelector('.friends-grid');

    // Сохраняем оригинальное состояние
    const originalNoFriendsHTML = noFriendsElement ? noFriendsElement.innerHTML : '';
    const getFriendCards = () => friendsGrid ? Array.from(friendsGrid.querySelectorAll('.friend-card')) : [];

    // Функция для выполнения поиска
    const performSearch = (rawTerm) => {
        const q = (rawTerm || '').toLowerCase().trim();
        let hasMatches = false;

        // Перебираем все карточки
        getFriendCards().forEach(card => {
            const username = (card.dataset.username || '').toLowerCase();
            const email = (card.dataset.email || '').toLowerCase();
            const first = (card.dataset.firstName || card.getAttribute('data-first-name') || '').toLowerCase();
            const last = (card.dataset.lastName || card.getAttribute('data-last-name') || '').toLowerCase();
            const fullFL = `${first} ${last}`.trim();
            const fullLF = `${last} ${first}`.trim();

            let isMatch = false;

            if (q === '') {
                isMatch = true;
            } else if (q.startsWith('@')) {
                const term = q.slice(1);
                isMatch = username.includes(term);
            } else {
                // username / email / Имя / Фамилия / «Фамилия Имя» / «Имя Фамилия»
                isMatch = (
                    username.includes(q) ||
                    email.includes(q) ||
                    first.includes(q) ||
                    last.includes(q) ||
                    fullLF.includes(q) ||
                    fullFL.includes(q)
                );
            }

            if (isMatch) {
                card.style.display = 'flex';
                hasMatches = true;
            } else {
                card.style.display = 'none';
            }
        });

        // Управление сообщениями
        if (noFriendsElement) {
            if (q !== '' && !hasMatches) {
                noFriendsElement.style.display = 'block';
                noFriendsElement.innerHTML = `
                    <div class="no-friends-icon">
                        <i class="bi bi-search"></i>
                    </div>
                    <h3>Ничего не найдено</h3>
                    <p>Попробуйте изменить поисковый запрос</p>
                `;
            } else {
                const totalCards = getFriendCards().length;
                noFriendsElement.style.display = q === '' && totalCards === 0 ? 'block' : 'none';
                if (q === '') {
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

    // Обработчик клика на карточки друзей для открытия профиля
    const initializeFriendCardClicks = () => {
        const friendCards = document.querySelectorAll('.friend-card');
        
        friendCards.forEach(card => {
            // Добавляем курсор pointer для указания кликабельности
            card.style.cursor = 'pointer';
            
            card.addEventListener('click', (e) => {
                // Проверяем, что клик не был по кнопке удаления
                if (e.target.closest('.friend-actions') || e.target.closest('button')) {
                    return; // Не открываем профиль, если кликнули по кнопке
                }
                
                // Получаем username из data-атрибута
                const username = card.getAttribute('data-username');
                if (username) {
                    // Переходим к профилю пользователя
                    window.location.href = `/profile/${username}`;
                }
            });
            
            // Добавляем hover эффект
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                card.style.transition = 'all 0.3s ease';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '';
            });
        });
    };
    
    // Инициализируем обработчики кликов
    initializeFriendCardClicks();

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