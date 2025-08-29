document.addEventListener('DOMContentLoaded', () => {
    const ui = {
        sidebarLinks: document.querySelectorAll('.account-sidebar nav a'),
        panels: document.querySelectorAll('.account-panel'),
        preferencesForm: document.getElementById('preferences-form'),
        favoritesGrid: document.getElementById('favorites-grid'),
    };

    let user = null;

    async function init() {
        await checkUserStatus();
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        setupEventListeners();
        loadPreferences();
        loadFavorites();
        handleInitialTab();
    }

    async function checkUserStatus() {
        try {
            const response = await fetch('/status'); // Using the worker proxy
            const data = await response.json();
            if (data.success && data.user) {
                user = data.user;
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

        if (ui.preferencesForm) {
            ui.preferencesForm.addEventListener('submit', handlePreferencesSubmit);
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

    async function loadPreferences() {
        try {
            const response = await fetch('/api/user/preferences');
            const data = await response.json();
            if (data.success && data.preferences) {
                populatePreferencesForm(data.preferences);
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }

    function populatePreferencesForm(prefs) {
        const form = ui.preferencesForm;
        if (!form) return;
        
        // Scent categories
        const categories = JSON.parse(prefs.scent_categories || '[]');
        form.querySelectorAll('input[name="scent_categories"]').forEach(checkbox => {
            checkbox.checked = categories.includes(checkbox.value);
        });

        // Intensity
        if (prefs.intensity) form.querySelector('#intensity').value = prefs.intensity;
    }

    async function handlePreferencesSubmit(e) {
        e.preventDefault();
        const formData = new FormData(ui.preferencesForm);
        const preferences = {
            scent_categories: formData.getAll('scent_categories'),
            intensity: formData.get('intensity'),
        };

        try {
            await fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences),
            });
            // Optionally show a success message
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }

    async function loadFavorites() {
        if (!ui.favoritesGrid) return;
        ui.favoritesGrid.innerHTML = ''; // Clear existing
        try {
            const response = await fetch('/api/user/favorites');
            const data = await response.json();
            if (data.success && data.favorites) {
                data.favorites.forEach(fav => {
                    const item = document.createElement('div');
                    item.className = 'favorite-item';
                    item.innerHTML = `
                        <img src="${fav.fragrance_image_url}" alt="${fav.fragrance_name}">
                        <p>${fav.fragrance_name}</p>
                    `;
                    ui.favoritesGrid.appendChild(item);
                });
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }

    init();
});
