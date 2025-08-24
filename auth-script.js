// Authentication Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const authForms = document.querySelectorAll('.auth-form');
    const authTabs = document.querySelector('.auth-tabs');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active form
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}-form`) {
                    form.classList.add('active');
                }
            });
            
            // Update tab indicator
            authTabs.setAttribute('data-active-tab', targetTab);
        });
    });

    // Password toggle functionality
    const passwordToggles = document.querySelectorAll('.password-toggle');
    
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.previousElementSibling;
            const icon = toggle.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // Form validation and submission
    const signinForm = document.getElementById('signin-form-element');
    const signupForm = document.getElementById('signup-form-element');

    // Sign In Form Validation
    if (signinForm) {
        signinForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('signin-email').value.trim();
            const password = document.getElementById('signin-password').value.trim();
            const submitBtn = signinForm.querySelector('.submit-btn');
            
            // Clear previous errors
            clearErrors('signin');
            
            // Validate email
            if (!email) {
                showError('signin-email-error', 'Email is required');
                return;
            }
            
            if (!isValidEmail(email)) {
                showError('signin-email-error', 'Please enter a valid email address');
                return;
            }
            
            // Validate password
            if (!password) {
                showError('signin-password-error', 'Password is required');
                return;
            }
            
            if (password.length < 6) {
                showError('signin-password-error', 'Password must be at least 6 characters');
                return;
            }
            
            // Simulate form submission
            submitForm(submitBtn, 'Sign In', () => {
                // Simulate API call
                setTimeout(() => {
                    showSuccessMessage('Sign in successful! Redirecting...');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);
                }, 2000);
            });
        });
    }

    // Sign Up Form Validation
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();
            const confirmPassword = document.getElementById('signup-confirm-password').value.trim();
            const agreeTerms = document.getElementById('agree-terms').checked;
            const submitBtn = signupForm.querySelector('.submit-btn');
            
            // Clear previous errors
            clearErrors('signup');
            
            // Validate name
            if (!name) {
                showError('signup-name-error', 'Full name is required');
                return;
            }
            
            if (name.length < 2) {
                showError('signup-name-error', 'Name must be at least 2 characters');
                return;
            }
            
            // Validate email
            if (!email) {
                showError('signup-email-error', 'Email is required');
                return;
            }
            
            if (!isValidEmail(email)) {
                showError('signup-email-error', 'Please enter a valid email address');
                return;
            }
            
            // Validate password
            if (!password) {
                showError('signup-password-error', 'Password is required');
                return;
            }
            
            if (password.length < 8) {
                showError('signup-password-error', 'Password must be at least 8 characters');
                return;
            }
            
            if (!isValidPassword(password)) {
                showError('signup-password-error', 'Password must contain at least one uppercase letter, one lowercase letter, and one number');
                return;
            }
            
            // Validate confirm password
            if (!confirmPassword) {
                showError('signup-confirm-password-error', 'Please confirm your password');
                return;
            }
            
            if (password !== confirmPassword) {
                showError('signup-confirm-password-error', 'Passwords do not match');
                return;
            }
            
            // Validate terms agreement
            if (!agreeTerms) {
                showError('signup-confirm-password-error', 'Please agree to the Terms of Service and Privacy Policy');
                return;
            }
            
            // Simulate form submission
            submitForm(submitBtn, 'Create Account', () => {
                // Simulate API call
                setTimeout(() => {
                    showSuccessMessage('Account created successfully! Welcome to Fragrance Collect.');
                    setTimeout(() => {
                        // Switch to sign in tab
                        document.querySelector('[data-tab="signin"]').click();
                        // Clear signup form
                        signupForm.reset();
                    }, 2000);
                }, 2000);
            });
        });
    }

    // Social sign-in buttons
    // The google.accounts.id.renderButton calls below will handle the Google buttons.
    // We remove the old placeholder listener.
    document.querySelectorAll('.social-btn:not(.google-btn)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const platform = 'Facebook'; // Example for other buttons
            showInfoMessage(`${platform} sign-in functionality will be implemented soon!`);
        });
    });

    // Forgot password link
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showInfoMessage('Password reset functionality will be implemented soon!');
        });
    }

    // --- Google Sign-In Implementation ---
    const GOOGLE_CLIENT_ID = "351083759622-fnmbu0am1knlj8ltcps8i7la64dhjpnn.apps.googleusercontent.com";
    const WORKER_URL = "https://auth-worker.joshuablaszczyk.workers.dev/verify";

    // Initialize the Google Sign-In client
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });

    // Render the Google Sign-In button for the sign-in form
    google.accounts.id.renderButton(
        document.getElementById('g_id_signin'), {
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left"
        }
    );

    // Render the Google Sign-In button for the sign-up form
    google.accounts.id.renderButton(
        document.getElementById('g_id_signup'), {
            theme: "outline",
            size: "large",
            text: "signup_with",
            shape: "rectangular",
            logo_alignment: "left"
        }
    );

    // Callback function to handle the response from Google
    async function handleCredentialResponse(response) {
        try {
            const res = await fetch(WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: response.credential }),
            });

            const data = await res.json();

            if (data.success && data.user) {
                // On successful verification, welcome the user and redirect
                showSuccessMessage(`Welcome, ${data.user.name}! You are now signed in.`);
                // Here you would typically also store a session token from your worker
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                // If the worker returns an error, show it to the user
                throw new Error(data.details || 'Verification failed.');
            }
        } catch (error) {
            console.error('Error during Google sign-in:', error);
            showNotification(`Sign-in failed: ${error.message}`, 'error');
        }
    }
    // --- End of Google Sign-In Implementation ---


    // Terms links
    const termsLinks = document.querySelectorAll('.terms-link');
    termsLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showInfoMessage('Terms of Service and Privacy Policy pages will be implemented soon!');
        });
    });

    // Input focus effects
    const inputs = document.querySelectorAll('.form-group input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
        });
    });

    // Real-time validation
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            validateField(input);
        });
    });
});

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPassword(password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    return passwordRegex.test(password);
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

function clearErrors(formType) {
    const errorElements = document.querySelectorAll(`#${formType}-form .error-message`);
    errorElements.forEach(element => {
        element.textContent = '';
        element.classList.remove('show');
    });
}

function validateField(input) {
    const fieldName = input.name;
    const value = input.value.trim();
    const errorId = `${input.id}-error`;
    
    // Clear previous error
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
    
    // Validate based on field type
    switch (fieldName) {
        case 'email':
            if (value && !isValidEmail(value)) {
                showError(errorId, 'Please enter a valid email address');
            }
            break;
        case 'password':
            if (value && value.length < 6) {
                showError(errorId, 'Password must be at least 6 characters');
            }
            break;
        case 'confirm-password':
            const password = document.getElementById('signup-password').value;
            if (value && value !== password) {
                showError(errorId, 'Passwords do not match');
            }
            break;
    }
}

function submitForm(submitBtn, defaultText, callback) {
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;
    
    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    // Execute callback
    if (callback) {
        callback();
    }
}

function showSuccessMessage(message) {
    showNotification(message, 'success');
}

function showInfoMessage(message) {
    showNotification(message, 'info');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle')}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--antique-gold)' : (type === 'error' ? '#c53030' : 'var(--deep-plum)')};
        color: ${type === 'success' ? 'var(--soft-black)' : 'var(--warm-white)'};
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 1rem;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Add notification animations to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-close {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: background-color 0.3s ease;
    }
    
    .notification-close:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .notification-content i {
        font-size: 1.2rem;
    }
`;
document.head.appendChild(style); 