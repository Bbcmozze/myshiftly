document.addEventListener('DOMContentLoaded', () => {
    const personalBtn = document.getElementById('personalCalendar').querySelector('button');
    const teamBtn = document.getElementById('teamCalendar').querySelector('button');

    personalBtn.addEventListener('click', () => {
        // Здесь будет переход к созданию личного календаря
        toastManager.show('Создание личного календаря', 'info');
        // Временная заглушка - можно удалить после реализации функционала
        setTimeout(() => {
            window.location.href = '/'; // Перенаправление на главную
        }, 1500);
    });

    teamBtn.addEventListener('click', () => {
        // Здесь будет переход к созданию командного календаря
        toastManager.show('Создание командного календаря', 'info');
        // Временная заглушка - можно удалить после реализации функционала
        setTimeout(() => {
            window.location.href = '/'; // Перенаправление на главную
        }, 1500);
    });

    // Анимация при наведении на карточки
    const cards = document.querySelectorAll('.creation-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            const icon = card.querySelector('.card-icon');
            icon.style.transform = 'scale(1.1)';
            icon.style.transition = 'transform 0.3s ease';
        });

        card.addEventListener('mouseleave', () => {
            const icon = card.querySelector('.card-icon');
            icon.style.transform = 'scale(1)';
        });
    });
});