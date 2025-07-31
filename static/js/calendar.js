document.addEventListener('DOMContentLoaded', () => {
    const personalBtn = document.getElementById('personalCalendar').querySelector('button');
    const teamBtn = document.getElementById('teamCalendar').querySelector('button');
    const creationForm = document.getElementById('creationForm');
    const formTitle = document.getElementById('formTitle');
    const calendarType = document.getElementById('calendarType');
    const cancelBtn = document.getElementById('cancelCreate');

    personalBtn.addEventListener('click', () => {
        formTitle.textContent = 'Создать личный календарь';
        calendarType.value = 'personal';
        creationForm.style.display = 'block';
    });

    teamBtn.addEventListener('click', () => {
        formTitle.textContent = 'Создать командный календарь';
        calendarType.value = 'team';
        creationForm.style.display = 'block';
    });

    cancelBtn.addEventListener('click', () => {
        creationForm.style.display = 'none';
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