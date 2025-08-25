// Secure Authentication Script for Fragrance Collect

// --- CONFIGURATION ---
const WORKER_URL = 'https://auth-worker.joshuablaszczyk.workers.dev';
// Make sure to replace this with your actual Google Client ID
const GOOGLE_CLIENT_ID = "351083759622-fnmbu0am1knlj8ltcps8i7la64dhjpnn.apps.googleusercontent.com"; 

// --- UI ELEMENT SELECTORS ---
const ui = {
    loggedOutView: document.getElementById('logged-out-view'),
    loggedInView: document.getElementById('logged-in-view'),
    userPicture: document.getElementById('user-picture'),
    userName: document.getElementById('user-name'),
    userEmail: document.getElementById('user-email'),
    logoutButton: document.getElementById('logout-button'),
    authStatus: document.getElementById('auth-status'),
    authTabs: document.querySelectorAll('.tab-btn'),
    authForms: document.querySelectorAll('.auth-form'),
    tabsContainer: document.querySelector('.auth-tabs'),
};

// --- CORE FUNCTIONS ---

/**
 * Updates the UI to reflect the user's authentication state.
 * @param {object|null} user - The user object if logged in, null otherwise.
 */
function updateUI(user) {
    if (user) {
        // User is logged in
        ui.loggedOutView.style.display = 'none';
        ui.loggedInView.style.display = 'block';
        
        ui.userPicture.src = user.picture || 'emblem.png'; // Fallback image
        ui.userPicture.alt = `${user.name || 'User'}'s profile picture`;
        ui.userName.textContent = user.name || 'Welcome';
        ui.userEmail.textContent = user.email || '';

        // Hide the Sign In/Sign Up tabs
        if (ui.tabsContainer) {
            ui.tabsContainer.style.display = 'none';
        }
    } else {
        // User is logged out
        ui.loggedOutView.style.display = 'block';
        ui.loggedInView.style.display = 'none';
        // Show the Sign In/Sign Up tabs
        if (ui.tabsContainer) {
            ui.tabsContainer.style.display = 'flex';
        }
    }
}

/**
 * Displays a status or error message in the UI.
 * @param {string} message - The message to display.
 * @param {boolean} isError - If true, styles the message as an error.
 */
function showStatus(message, isError = false) {
    if (ui.authStatus) {
        ui.authStatus.textContent = message;
        ui.authStatus.className = isError ? 'error-message show' : 'success-message show';
        
        // Hide the message after 5 seconds
        setTimeout(() => {
            ui.authStatus.textContent = '';
            ui.authStatus.className = 'error-message';
        }, 5000);
    }
}


/**
 * Callback function for Google Sign-In. Sends the credential to the backend.
 * @param {object} response - The credential response from Google.
 */
async function handleCredentialResponse(response) {
    showStatus('Verifying your credentials...');
    try {
        const res = await fetch(`${WORKER_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // The body now sends the credential object from Google
            body: JSON.stringify({ credential: response.credential }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showStatus('Login successful! Welcome.');
            updateUI(data.user);
        } else {
            // Use the detailed error message from the worker if available
            throw new Error(data.details || data.error || 'Login failed. Please try again.');
        }
    } catch (error) {
        console.error('Login process error:', error);
        showStatus(error.message, true);
        updateUI(null);
    }
}

/**
 * Checks the user's login status by calling the /status endpoint.
 */
async function checkUserStatus() {
    try {
        // The browser automatically sends the secure cookie with this request
        const res = await fetch(`${WORKER_URL}/status`);
        const data = await res.json();
        
        if (res.ok && data.success) {
            updateUI(data.user);
        } else {
            updateUI(null);
        }
    } catch (error) {
        console.error('Error checking user status:', error);
        showStatus('Could not verify session. Please sign in.', true);
        updateUI(null);
    }
}

/**
 * Handles user logout by calling the /logout endpoint.
 */
async function logout() {
    showStatus('Signing out...');
    try {
        const res = await fetch(`${WORKER_URL}/logout`, { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.success) {
            showStatus('You have been signed out successfully.');
            updateUI(null);
        } else {
            throw new Error(data.error || 'Logout failed.');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showStatus(error.message, true);
    }
}


// --- INITIALIZATION ---

/**
 * Initializes the Google Sign-In buttons.
 */
function initializeGoogleSignIn() {
    if (typeof google === 'undefined') {
        console.error('Google GSI script not loaded.');
        showStatus('Could not load Google Sign-In.', true);
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });

    // Render the Sign In button
    const signInButton = document.getElementById('g_id_signin');
    if (signInButton) {
        google.accounts.id.renderButton(signInButton, { 
            theme: "filled_black", 
            size: "large", 
            text: "continue_with", 
            shape: "rectangular",
            width: "380"
        });
    }
    
    // Render the Sign Up button
    const signUpButton = document.getElementById('g_id_signup');
    if (signUpButton) {
         google.accounts.id.renderButton(signUpButton, { 
            theme: "filled_black", 
            size: "large", 
            text: "signup_with", 
            shape: "rectangular",
            width: "380"
        });
    }
}


/**
 * Sets up event listeners for the page.
 */
function setupEventListeners() {
    // Tab switching
    ui.authTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            ui.authTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            ui.authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}-form`) {
                    form.classList.add('active');
                }
            });
            ui.tabsContainer.setAttribute('data-active-tab', targetTab);
        });
    });

    // Logout button
    if (ui.logoutButton) {
        ui.logoutButton.addEventListener('click', logout);
    }
}


// --- PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkUserStatus(); // Check if user is already logged in
    
    // The Google script is loaded with 'async defer', so we can initialize it here.
    // The `g_id_onload` div in the HTML also helps ensure it's ready.
    initializeGoogleSignIn(); 
}); 