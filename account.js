document.addEventListener('DOMContentLoaded', () => {
    console.log('Account.js: DOM loaded, starting initialization...');
    
    const ui = {
        sidebarLinks: document.querySelectorAll('.account-sidebar nav a'),
        panels: document.querySelectorAll('.account-panel'),
        preferencesForm: document.getElementById('preferences-form'),
        favoritesGrid: document.getElementById('favorites-grid'),
        profileForm: document.getElementById('profile-form'),
    };

    let user = null;

    async function init() {
        console.log('Account.js: Starting init...');
        // Wait for shared auth to initialize first
        await waitForSharedAuth();
        await checkUserStatus();
        console.log('Account.js: User check complete, user:', user);
        if (!user) {
            console.log('Account.js: No user found, redirecting to auth...');
            window.location.href = 'auth.html';
            return;
        }
        console.log('Account.js: User found, setting up page...');
        setupEventListeners();
        loadUserProfile();
        loadPreferences();
        loadFavorites();
        handleInitialTab();
    }

    async function waitForSharedAuth() {
        console.log('Account.js: Waiting for shared auth...');
        // Wait for shared auth to complete its initialization
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        // Give shared-auth.js a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        while (attempts < maxAttempts) {
            if (typeof getCurrentUser === 'function') {
                const sharedUser = getCurrentUser();
                console.log('Account.js: getCurrentUser returned:', sharedUser);
                if (sharedUser) {
                    console.log('Shared auth user found:', sharedUser);
                    user = sharedUser;
                    return;
                }
            } else {
                console.log('Account.js: getCurrentUser function not available yet, attempt:', attempts);
            }
            
            // Wait 100ms before next attempt
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        console.log('Shared auth not available after waiting');
    }

    async function checkUserStatus() {
        // If we already have user from shared auth, use it
        if (user) {
            console.log('Using user from shared auth:', user);
            return;
        }

        try {
            // Fallback to direct API call
            const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/status', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success && data.user) {
                user = data.user;
                console.log('User found via API:', user);
            }
        } catch (error) {
            console.error('Error checking user status:', error);
        }
    }

    function setupEventListeners() {
        ui.sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                switchPanel(targetId);
                window.history.pushState(null, '', `#${targetId}`);
            });
        });

        // Note: Profile and preferences form event listeners will be set up after forms are populated
        // in loadUserProfile() and loadPreferences() functions
    }

    function setupFormEventListeners() {
        console.log('Setting up form event listeners...');
        
        // Set up profile form event listener
        if (ui.profileForm) {
            console.log('Setting up profile form event listener');
            // Remove existing listeners to prevent duplicates
            const newProfileForm = ui.profileForm.cloneNode(true);
            ui.profileForm.parentNode.replaceChild(newProfileForm, ui.profileForm);
            ui.profileForm = newProfileForm;
            
            ui.profileForm.addEventListener('submit', handleProfileSubmit);
            console.log('Profile form submit listener added');
            
            // Add profile picture upload event listener
            const profilePictureInput = document.getElementById('profile-picture');
            if (profilePictureInput) {
                profilePictureInput.addEventListener('change', handleProfilePictureUpload);
                console.log('Profile picture upload listener added');
            } else {
                console.log('Profile picture input not found');
            }
        } else {
            console.log('Profile form not found');
        }

        // Set up preferences form event listener
        if (ui.preferencesForm) {
            console.log('Setting up preferences form event listener');
            // Remove existing listeners to prevent duplicates
            const newPreferencesForm = ui.preferencesForm.cloneNode(true);
            ui.preferencesForm.parentNode.replaceChild(newPreferencesForm, ui.preferencesForm);
            ui.preferencesForm = newPreferencesForm;
            
            ui.preferencesForm.addEventListener('submit', handlePreferencesSubmit);
            console.log('Preferences form submit listener added');
        } else {
            console.log('Preferences form not found');
        }

        // Add logout button event listener
        const logoutBtn = document.getElementById('account-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleAccountLogout);
            console.log('Logout button listener added');
        } else {
            console.log('Logout button not found');
        }
    }

    function switchPanel(targetId) {
        ui.panels.forEach(panel => {
            panel.classList.toggle('active', panel.id === targetId);
        });
        ui.sidebarLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${targetId}`);
        });
    }

    function handleInitialTab() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            switchPanel(hash);
        } else {
            switchPanel('profile');
        }
    }

    async function loadUserProfile() {
        if (!ui.profileForm) return;
        
        // Populate profile form with user data
        ui.profileForm.innerHTML = `
            <div class="form-group">
                <label for="profile-name">Full Name</label>
                <input type="text" id="profile-name" name="name" value="${user.name || ''}" required>
            </div>
            <div class="form-group">
                <label for="profile-email">Email</label>
                <input type="email" id="profile-email" name="email" value="${user.email || ''}" required readonly>
                <small>Email cannot be changed</small>
            </div>
            <div class="form-group">
                <label for="profile-picture">Profile Picture</label>
                <input type="file" id="profile-picture" name="picture" accept="image/*">
                <div class="current-picture">
                    <img src="${user.picture || 'emblem.png'}" alt="Profile Picture" id="current-picture">
                </div>
            </div>
            <button type="submit" class="btn">Update Profile</button>
        `;

        // Update header display
        updateHeaderDisplay();
        
        // Set up form event listeners after form is populated
        setupFormEventListeners();
    }

    function updateHeaderDisplay() {
        const headerProfileImg = document.getElementById('header-profile-picture');
        const headerUserName = document.getElementById('header-user-name');
        
        if (headerProfileImg) {
            headerProfileImg.src = user.picture || 'emblem.png';
            headerProfileImg.alt = `${user.name || 'User'}'s Profile Picture`;
        }
        
        if (headerUserName) {
            headerUserName.textContent = `Welcome, ${user.name || 'User'}`;
        }
    }

    async function handleProfilePictureUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image file size must be less than 5MB.');
            return;
        }

        try {
            // Create a preview
            const reader = new FileReader();
            reader.onload = function(e) {
                const currentPicture = document.getElementById('current-picture');
                const headerProfileImg = document.getElementById('header-profile-picture');
                
                if (currentPicture) {
                    currentPicture.src = e.target.result;
                }
                if (headerProfileImg) {
                    headerProfileImg.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);

            // Upload the file
            const formData = new FormData();
            formData.append('picture', file);

            const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/api/user/profile-picture', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.picture_url) {
                    user.picture = data.picture_url;
                    alert('Profile picture updated successfully!');
                }
            } else {
                alert('Failed to upload profile picture. Please try again.');
            }
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            alert('Error uploading profile picture. Please try again.');
        }
    }

    async function handleAccountLogout() {
        if (confirm('Are you sure you want to sign out?')) {
            try {
                await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
            } finally {
                // Always redirect, even if server call fails
                window.location.href = 'auth.html';
            }
        }
    }

    async function loadPreferences() {
        try {
            const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/api/user/preferences', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success && data.preferences) {
                populatePreferencesForm(data.preferences);
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
            // Show default form if API fails
            showDefaultPreferencesForm();
        }
    }

    function showDefaultPreferencesForm() {
        if (!ui.preferencesForm) return;
        
        ui.preferencesForm.innerHTML = `
            <div class="form-group">
                <label>Favorite Scent Families</label>
                <div class="checkbox-group">
                    <label><input type="checkbox" name="scent_categories" value="woody"> Woody</label>
                    <label><input type="checkbox" name="scent_categories" value="floral"> Floral</label>
                    <label><input type="checkbox" name="scent_categories" value="citrus"> Citrus</label>
                    <label><input type="checkbox" name="scent_categories" value="oriental"> Oriental</label>
                    <label><input type="checkbox" name="scent_categories" value="fresh"> Fresh</label>
                </div>
            </div>
            <div class="form-group">
                <label for="intensity">Preferred Intensity</label>
                <select id="intensity" name="intensity">
                    <option value="">Select...</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="strong">Strong</option>
                </select>
            </div>
            <button type="submit" class="btn">Save Preferences</button>
        `;
        
        // Set up form event listeners after form is populated
        setupFormEventListeners();
    }

    function populatePreferencesForm(prefs) {
        const form = ui.preferencesForm;
        if (!form) return;
        
        // Scent categories
        const categories = Array.isArray(prefs.scent_categories) ? prefs.scent_categories : [];
        form.querySelectorAll('input[name="scent_categories"]').forEach(checkbox => {
            checkbox.checked = categories.includes(checkbox.value);
        });

        // Intensity
        if (prefs.intensity) form.querySelector('#intensity').value = prefs.intensity;
        
        // Set up form event listeners after form is populated
        setupFormEventListeners();
    }

    async function handleProfileSubmit(e) {
        e.preventDefault();
        console.log('Profile submit triggered');
        
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        // Show loading state
        submitButton.textContent = 'Updating...';
        submitButton.disabled = true;
        
        const formData = new FormData(ui.profileForm);
        const profileData = {
            name: formData.get('name'),
            email: formData.get('email')
        };

        console.log('Profile data to submit:', profileData);

        try {
            const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(profileData),
            });
            
            console.log('Profile update response status:', response.status);
            
            if (response.ok) {
                const responseData = await response.json();
                console.log('Profile update response data:', responseData);
                
                if (responseData.success) {
                    alert('Profile updated successfully!');
                    // Update the user object
                    user.name = profileData.name;
                    user.email = profileData.email;
                    // Update header display
                    updateHeaderDisplay();
                } else {
                    alert(`Failed to update profile: ${responseData.error || 'Unknown error'}`);
                }
            } else {
                const errorText = await response.text();
                console.log('Profile update error response:', errorText);
                alert(`Failed to update profile: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Error updating profile. Please check your connection and try again.');
        } finally {
            // Restore button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    async function handlePreferencesSubmit(e) {
        e.preventDefault();
        console.log('Preferences submit triggered');
        
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        // Show loading state
        submitButton.textContent = 'Saving...';
        submitButton.disabled = true;
        
        const formData = new FormData(ui.preferencesForm);
        const preferences = {
            scent_categories: formData.getAll('scent_categories'),
            intensity: formData.get('intensity'),
        };

        console.log('Preferences data to submit:', preferences);

        try {
            const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(preferences),
            });
            
            console.log('Preferences save response status:', response.status);
            
            if (response.ok) {
                const responseData = await response.json();
                console.log('Preferences save response data:', responseData);
                
                if (responseData.success) {
                    alert('Preferences saved successfully!');
                } else {
                    alert(`Failed to save preferences: ${responseData.error || 'Unknown error'}`);
                }
            } else {
                const errorText = await response.text();
                console.log('Preferences save error response:', errorText);
                alert(`Failed to save preferences: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
            alert('Error saving preferences. Please check your connection and try again.');
        } finally {
            // Restore button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    async function loadFavorites() {
        if (!ui.favoritesGrid) return;
        ui.favoritesGrid.innerHTML = ''; // Clear existing
        
        try {
            const response = await fetch('https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/api/user/favorites', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success && data.favorites && data.favorites.length > 0) {
                data.favorites.forEach(fav => {
                    const item = document.createElement('div');
                    item.className = 'favorite-item';
                    item.innerHTML = `
                        <img src="${fav.fragrance_image_url || 'emblem.png'}" alt="${fav.fragrance_name}">
                        <p>${fav.fragrance_name}</p>
                    `;
                    ui.favoritesGrid.appendChild(item);
                });
            } else {
                ui.favoritesGrid.innerHTML = '<p class="no-favorites">You haven\'t added any favorites yet. <a href="main.html">Browse fragrances</a> to get started!</p>';
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
            ui.favoritesGrid.innerHTML = '<p class="error">Error loading favorites. Please try again later.</p>';
        }
    }

    init();
});
