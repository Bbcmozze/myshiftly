document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addFriendToggle');
    const addForm = document.getElementById('addFriendForm');
    const bell = document.getElementById('toggleRequests');
    const dropdown = document.getElementById('requestsDropdown');

    if (addBtn && addForm) {
        addBtn.addEventListener('click', () => {
            addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (bell && dropdown) {
        bell.addEventListener('click', () => {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
    }
});
