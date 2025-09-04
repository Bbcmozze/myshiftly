// Profile page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const editPersonalBtn = document.getElementById('editPersonalBtn');
    const personalDataContent = document.getElementById('personalDataContent');
    const personalDataEdit = document.getElementById('personalDataEdit');
    const personalDataForm = document.getElementById('personalDataForm');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const passwordChangeForm = document.getElementById('passwordChangeForm');
    const passwordForm = document.getElementById('passwordForm');
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    const deleteAvatarBtn = document.getElementById('deleteAvatarBtn');
    const profileAvatar = document.getElementById('profileAvatar');
    
    const achievementsBtn = document.getElementById('achievementsBtn');

    // Use global toast manager from base.js
    function showToast(message, type = 'success') {
        if (window.toastManager) {
            window.toastManager.show(message, type);
        } else {
            // Fallback if toastManager is not available
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    // Personal data editing
    if (editPersonalBtn) {
        editPersonalBtn.addEventListener('click', function() {
            personalDataContent.style.display = 'none';
            personalDataEdit.style.display = 'block';
            editPersonalBtn.style.display = 'none';
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            personalDataContent.style.display = 'grid';
            personalDataEdit.style.display = 'none';
            editPersonalBtn.style.display = 'flex';
            
            // Reset form values
            personalDataForm.reset();
            // Restore original values
            document.getElementById('editFirstName').value = document.querySelector('[data-field="first_name"]').textContent;
            document.getElementById('editLastName').value = document.querySelector('[data-field="last_name"]').textContent;
            document.getElementById('editUsername').value = document.querySelector('[data-field="username"]').textContent;
            document.getElementById('editEmail').value = document.querySelector('[data-field="email"]').textContent;
            const ageValue = document.querySelector('[data-field="age"]').textContent;
            document.getElementById('editAge').value = ageValue === 'Не указан' ? '' : ageValue;
            const phoneValue = document.querySelector('[data-field="phone"]').textContent;
            document.getElementById('editPhone').value = phoneValue === 'Не указан' ? '' : phoneValue;
        });
    }

    // Personal data form submission
    if (personalDataForm) {
        personalDataForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(personalDataForm);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const response = await fetch('/profile/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Update displayed values
                    document.querySelector('[data-field="first_name"]').textContent = data.first_name;
                    document.querySelector('[data-field="last_name"]').textContent = data.last_name;
                    document.querySelector('[data-field="username"]').textContent = data.username;
                    document.querySelector('[data-field="email"]').textContent = data.email;
                    document.querySelector('[data-field="age"]').textContent = data.age || 'Не указан';
                    document.querySelector('[data-field="phone"]').textContent = data.phone || 'Не указан';
                    
                    // Update header name
                    const employeeName = document.querySelector('.employee-name');
                    if (employeeName) {
                        employeeName.textContent = `${data.first_name} ${data.last_name}`;
                    }
                    
                    // Update username in header
                    const employeeUsername = document.querySelector('.employee-username');
                    if (employeeUsername) {
                        employeeUsername.textContent = `@${data.username}`;
                    }
                    
                    // Hide edit form
                    personalDataContent.style.display = 'grid';
                    personalDataEdit.style.display = 'none';
                    editPersonalBtn.style.display = 'flex';
                    
                    showToast(result.message);
                } else {
                    showToast(result.message, 'error');
                }
            } catch (error) {
                showToast('Ошибка при обновлении профиля', 'error');
                console.error('Error:', error);
            }
        });
    }

    // Password change functionality
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            passwordChangeForm.style.display = 'block';
            changePasswordBtn.style.display = 'none';
        });
    }

    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', function() {
            passwordChangeForm.style.display = 'none';
            changePasswordBtn.style.display = 'flex';
            passwordForm.reset();
        });
    }

    // Password form submission
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Validate passwords match
            if (newPassword !== confirmPassword) {
                showToast('Новые пароли не совпадают', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                showToast('Пароль должен содержать минимум 6 символов', 'error');
                return;
            }
            
            try {
                const response = await fetch('/profile/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    passwordChangeForm.style.display = 'none';
                    changePasswordBtn.style.display = 'flex';
                    passwordForm.reset();
                    showToast(result.message);
                } else {
                    showToast(result.message, 'error');
                }
            } catch (error) {
                showToast('Ошибка при смене пароля', 'error');
                console.error('Error:', error);
            }
        });
    }

    // Avatar management
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', function() {
            // Trigger the existing avatar upload modal from base.js
            const avatarContainer = document.getElementById('avatarContainer');
            if (avatarContainer) {
                avatarContainer.click();
            }
        });
    }

    // Modal elements
    const deleteAvatarModal = document.getElementById('deleteAvatarModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

    // Function to show delete modal
    function showDeleteModal() {
        deleteAvatarModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    // Function to hide delete modal
    function hideDeleteModal() {
        deleteAvatarModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
    }

    // Delete avatar button click - show modal
    if (deleteAvatarBtn) {
        deleteAvatarBtn.addEventListener('click', function() {
            showDeleteModal();
        });
    }

    // Cancel delete button
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            hideDeleteModal();
        });
    }

    // Confirm delete button
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async function() {
            hideDeleteModal();
            
            try {
                const response = await fetch('/profile/delete-avatar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Update avatar image
                    profileAvatar.src = result.avatar_url;
                    
                    // Update sidebar avatar
                    const sidebarAvatar = document.getElementById('userAvatar');
                    if (sidebarAvatar) {
                        sidebarAvatar.src = result.avatar_url;
                    }
                    
                    // Hide delete button
                    deleteAvatarBtn.style.display = 'none';
                    
                    showToast(result.message);
                } else {
                    showToast(result.message, 'error');
                }
            } catch (error) {
                showToast('Ошибка при удалении аватара', 'error');
                console.error('Error:', error);
            }
        });
    }

    // Close modal when clicking outside
    if (deleteAvatarModal) {
        deleteAvatarModal.addEventListener('click', function(e) {
            if (e.target === deleteAvatarModal) {
                hideDeleteModal();
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && deleteAvatarModal.style.display === 'flex') {
            hideDeleteModal();
        }
    });

    // Achievements button (placeholder functionality)
    if (achievementsBtn) {
        achievementsBtn.addEventListener('click', function() {
            showToast('Раздел достижений будет доступен в будущих обновлениях!', 'info');
        });
    }

    // Phone number formatting
    const phoneInput = document.getElementById('editPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            
            if (value.startsWith('7')) {
                value = value.substring(1);
            }
            
            if (value.length > 0) {
                if (value.length <= 3) {
                    value = `+7 (${value}`;
                } else if (value.length <= 6) {
                    value = `+7 (${value.substring(0, 3)}) ${value.substring(3)}`;
                } else if (value.length <= 8) {
                    value = `+7 (${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6)}`;
                } else {
                    value = `+7 (${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6, 8)}-${value.substring(8, 10)}`;
                }
            }
            
            e.target.value = value;
        });
    }

    // Listen for avatar updates from base.js
    document.addEventListener('avatarUpdated', function(e) {
        if (e.detail && e.detail.avatarUrl) {
            // Обновляем аватар на странице профиля
            if (profileAvatar) {
                profileAvatar.src = e.detail.avatarUrl;
            }
            
            // Показываем кнопку удаления если аватар не дефолтный
            if (deleteAvatarBtn && !e.detail.avatarUrl.includes('default_avatar.svg')) {
                deleteAvatarBtn.style.display = 'flex';
            } else if (deleteAvatarBtn && e.detail.avatarUrl.includes('default_avatar.svg')) {
                deleteAvatarBtn.style.display = 'none';
            }
        }
    });
});

