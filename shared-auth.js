// Shared Authentication Script for All Pages
// This script provides session persistence across all pages

// Global authentication state
let isUserLoggedIn = false;
let currentUser = null;
let sessionToken = null;

// Common UI elements for authentication (adjust selectors per page as needed)
const sharedAuthUI = {
    loginBtn: null,
    userWelcome: null,
    userNameDisplay: null,
    logoutLink: null,
    
    // Initialize UI elements (call this from each page)
    init() {
        this.loginBtn = document.getElementById('login-btn');
        this.userWelcome = document.getElementById('user-welcome');
        this.userNameDisplay = document.getElementById('user-name-display');
        this.logoutLink = document.getElementById('logout-link');
    }
};

// Get session token for cross-origin requests
async function getSessionToken() {
    try {
        const response = await fetch('https://auth-worker.joshuablaszczyk.workers.dev/token', {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.token) {
            sessionToken = data.token;
            return data.token;
        }
    } catch (error) {
        console.error('Error getting session token:', error);
    }
    return null;
}

// Check user authentication status
async function checkSharedUserStatus() {
    try {
        // First try to get the session token
        if (!sessionToken) {
            await getSessionToken();
        }

        const headers = { 'Content-Type': 'application/json' };
        
        // Add Authorization header if we have a token (for cross-origin)
        if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await fetch('https://auth-worker.joshuablaszczyk.workers.dev/status', {
            method: 'GET',
            headers,
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.user) {
            console.log('User is logged in:', data.user.name);
            currentUser = data.user;
            updateSharedNavUI(data.user);
        } else {
            console.log('User is not logged in');
            sessionToken = null; // Clear invalid token
            updateSharedNavUI(null);
        }
    } catch (error) {
        console.error('Error checking authentication status:', error);
        sessionToken = null; // Clear token on error
        updateSharedNavUI(null);
    }
}

// Update navigation UI based on authentication status
function updateSharedNavUI(user) {
    console.log('updateSharedNavUI called with user:', user);
    
    if (user) {
        // User is logged in
        isUserLoggedIn = true;
        currentUser = user;
        console.log('Setting isUserLoggedIn to true');
        
        if (sharedAuthUI.loginBtn) sharedAuthUI.loginBtn.style.display = 'none';
        if (sharedAuthUI.userWelcome) sharedAuthUI.userWelcome.style.display = 'flex';
        if (sharedAuthUI.userNameDisplay) {
            const firstName = user.name.split(' ')[0];
            sharedAuthUI.userNameDisplay.textContent = firstName;
            // Only call updateDynamicGreeting if it exists (main.html specific)
            if (typeof updateDynamicGreeting === 'function') {
                updateDynamicGreeting(firstName);
            }
        }
    } else {
        // User is logged out
        isUserLoggedIn = false;
        currentUser = null;
        console.log('Setting isUserLoggedIn to false');
        
        if (sharedAuthUI.loginBtn) sharedAuthUI.loginBtn.style.display = 'flex';
        if (sharedAuthUI.userWelcome) sharedAuthUI.userWelcome.style.display = 'none';
    }
}

// Handle logout functionality
async function handleSharedLogout() {
    try {
        await fetch('https://auth-worker.joshuablaszczyk.workers.dev/logout', {
            method: 'POST',
        });
    } finally {
        // Always update UI and redirect, even if server call fails
        isUserLoggedIn = false;
        currentUser = null;
        updateSharedNavUI(null);
        window.location.href = 'auth.html';
    }
}

// Initialize shared authentication on page load
function initSharedAuth() {
    // Initialize UI elements
    sharedAuthUI.init();
    
    // Check authentication status
    checkSharedUserStatus();
    
    // Add logout event listener if logout link exists
    if (sharedAuthUI.logoutLink) {
        sharedAuthUI.logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleSharedLogout();
        });
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initSharedAuth();
});

// Utility function to check if user is authenticated (for other scripts to use)
function isAuthenticated() {
    return isUserLoggedIn && currentUser !== null;
}

// Get current user data
function getCurrentUser() {
    return currentUser;
}
