document.addEventListener('DOMContentLoaded', function() {
    // Находим элементы по более надежному селектору
    const personalCard = document.querySelector('#personalCalendar');
    const teamCard = document.querySelector('#teamCalendar');
    const creationFormContainer = document.querySelector('.creation-form-container');
    const formTitle = document.getElementById('formTitle');
    const calendarType = document.getElementById('calendarType');
    const cancelBtn = document.getElementById('cancelCreate');

    // Проверяем, что элементы существуют
    if (!personalCard || !teamCard || !creationFormContainer) {
        console.error('Не удалось найти необходимые элементы на странице');
        return;
    }

    // Функция для плавной прокрутки
    function scrollToForm() {
        creationFormContainer.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    // Обработчик для обеих карточек
    function handleCardClick(event) {
        // Проверяем, была ли нажата именно кнопка
        const button = event.target.closest('button');
        if (!button) return;

        // Определяем тип календаря
        const isTeam = event.currentTarget.id === 'teamCalendar';

        formTitle.textContent = isTeam
            ? 'Создать командный календарь'
            : 'Создать личный календарь';

        calendarType.value = isTeam ? 'team' : 'personal';

        // Показываем форму и прокручиваем к ней
        creationFormContainer.style.display = 'block';
        setTimeout(scrollToForm, 50); // Небольшая задержка для надежности
    }

    // Назначаем обработчики
    personalCard.addEventListener('click', handleCardClick);
    teamCard.addEventListener('click', handleCardClick);

    // Обработчик для кнопки "Отмена"
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            creationFormContainer.style.display = 'none';
        });
    }

    // Анимация при наведении на карточки
    const cards = document.querySelectorAll('.creation-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            const icon = this.querySelector('.card-icon');
            if (icon) {
                icon.style.transform = 'scale(1.1)';
            }
        });

        card.addEventListener('mouseleave', function() {
            const icon = this.querySelector('.card-icon');
            if (icon) {
                icon.style.transform = 'scale(1)';
            }
        });
    });
});