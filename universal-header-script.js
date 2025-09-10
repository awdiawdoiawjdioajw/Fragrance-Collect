// Universal Header Script for Fragrance Collect
// This script works across all pages and handles navigation appropriately

// Function to update authentication state visibility
function updateAuthStateVisibility() {
    const isLoggedIn = document.body.classList.contains('user-logged-in');
    
    // Update desktop profile menu
    const loggedInItems = document.querySelectorAll('.logged-in-only');
    const loggedOutItems = document.querySelectorAll('.logged-out-only');
    
    loggedInItems.forEach(item => {
        item.style.display = isLoggedIn ? 'block' : 'none';
    });
    
    loggedOutItems.forEach(item => {
        item.style.display = isLoggedIn ? 'none' : 'block';
    });
}

// Listen for authentication state changes
document.addEventListener('DOMContentLoaded', function() {
    // Initial state update
    updateAuthStateVisibility();
    
    // Listen for authentication state changes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                updateAuthStateVisibility();
            }
        });
    });
    
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // Device detection for different menu behaviors
    const isMobile = window.innerWidth <= 768;
    let isMenuOpen = false;

    // Get current page name
    const currentPage = window.location.pathname.split('/').pop() || 'main.html';
    const isMainPage = currentPage === 'main.html' || currentPage === 'index.html';

    // Mobile menu toggle functionality (for mobile devices)
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNavMenu = document.querySelector('.mobile-nav-menu');

    // PC dropdown functionality (for desktop)
    const menuDropdown = document.querySelector('.menu-dropdown');
    const megaMenu = document.querySelector('.mega-menu');

    if (isMobile) {
        // Mobile behavior: hamburger menu
        if (mobileMenuToggle && mobileNavMenu) {
            mobileMenuToggle.addEventListener('click', function() {
                isMenuOpen = !isMenuOpen;
                mobileNavMenu.classList.toggle('active', isMenuOpen);

                // Animate hamburger icon
                const lines = this.querySelectorAll('.hamburger-line');
                if (isMenuOpen) {
                    lines[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                    lines[1].style.opacity = '0';
                    lines[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
                } else {
                    lines[0].style.transform = 'none';
                    lines[1].style.opacity = '1';
                    lines[2].style.transform = 'none';
                }
            });

            // Close mobile menu when clicking a link
            const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
            mobileNavLinks.forEach(link => {
                link.addEventListener('click', function() {
                    mobileNavMenu.classList.remove('active');
                    isMenuOpen = false;
                    const lines = mobileMenuToggle.querySelectorAll('.hamburger-line');
                    lines[0].style.transform = 'none';
                    lines[1].style.opacity = '1';
                    lines[2].style.transform = 'none';
                });
            });
        }
    } else {
        // PC behavior: hover dropdown
        if (menuDropdown && megaMenu) {
            // Close menu when clicking outside
            document.addEventListener('click', function(e) {
                if (!menuDropdown.contains(e.target)) {
                    // Menu will close via CSS hover, but we can add additional logic here if needed
                }
            });
        }
    }

    // Header search button functionality (only for header search button, not filter search button)
    const headerSearchBtn = document.querySelector('.utility-section .search-btn');
    if (headerSearchBtn) {
        headerSearchBtn.addEventListener('click', function(e) {
            e.preventDefault();

            if (isMainPage) {
                // On main page, scroll to search section
                const searchSection = document.getElementById('filter');
                if (searchSection) {
                    searchSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // Focus on the search input after scrolling
                    setTimeout(() => {
                        const searchInput = document.getElementById('main-search');
                        if (searchInput) {
                            searchInput.focus();
                        }
                    }, 800);
                }
            } else {
                // On other pages, redirect to main page search section
                window.location.href = 'main.html#filter';
            }
        });
    }

    // Universal navigation link functionality
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Check if this is the personalized link and handle it separately
            if (href === 'main.html#personalized') {
                if (typeof getPersonalizedRecommendations === 'function') {
                    e.preventDefault();
                    getPersonalizedRecommendations();
                }
                return; // Stop further processing for this link
            }

            // For all other links, perform the standard filter link handling
            if (href.includes('main.html#filter')) {
                e.preventDefault();
                
                if (isMainPage) {
                    // Check if we're in favorites view and need to exit it first
                    const favoritesSection = document.getElementById('favorites');
                    const isInFavoritesView = favoritesSection && favoritesSection.style.display === 'block';
                    
                    if (isInFavoritesView) {
                        // Exit favorites view first
                        if (typeof showMainContentView === 'function') {
                            showMainContentView();
                        }
                        // Small delay to ensure the view switches before scrolling
                        setTimeout(() => {
                            const targetId = href.substring(10); // Remove 'main.html#'
                            const targetSection = document.getElementById(targetId);
                            if (targetSection) {
                                targetSection.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start'
                                });
                            }
                        }, 100);
                    } else {
                        // Normal navigation - scroll to section
                        const targetId = href.substring(10); // Remove 'main.html#'
                        const targetSection = document.getElementById(targetId);

                        if (targetSection) {
                            targetSection.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }
                } else {
                    // On other pages, redirect to main page section
                    window.location.href = href;
                }
            }
        });
    });

    // Universal brand logo functionality
    const brandLogo = document.querySelector('.brand-logo');
    if (brandLogo) {
        brandLogo.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (isMainPage) {
                // Check if we're in favorites view and need to exit it first
                const favoritesSection = document.getElementById('favorites');
                const isInFavoritesView = favoritesSection && favoritesSection.style.display === 'block';
                
                if (isInFavoritesView) {
                    // Exit favorites view first
                    if (typeof showMainContentView === 'function') {
                        showMainContentView();
                    }
                    // Scroll to top of page
                    setTimeout(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 100);
                } else {
                    // Normal behavior - scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else {
                // On other pages, redirect to main page
                window.location.href = 'main.html';
            }
        });
    }

    // Universal favorites button functionality
    const favoritesBtn = document.querySelector('.favorites-btn');
    if (favoritesBtn) {
        favoritesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (isMainPage) {
                // On main page, scroll to favorites section
                const favoritesSection = document.getElementById('favorites');
                if (favoritesSection) {
                    favoritesSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            } else {
                // On other pages, redirect to main page favorites section
                window.location.href = 'main.html#favorites';
            }
        });
    }

    // Universal mega menu links functionality
    const megaMenuLinks = document.querySelectorAll('.mega-menu a');
    megaMenuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            const linkText = this.textContent.trim();
            
            e.preventDefault();
            
            if (isMainPage) {
                // On main page, handle different types of links
                handleMegaMenuLink(linkText, href);
            } else {
                // On other pages, redirect to main page with appropriate action
                redirectToMainPage(linkText, href);
            }
        });
    });

    // Universal mobile navigation links functionality
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href && href.startsWith('main.html#')) {
                e.preventDefault();
                
                if (isMainPage) {
                    // Check if we're in favorites view and need to exit it first
                    const favoritesSection = document.getElementById('favorites');
                    const isInFavoritesView = favoritesSection && favoritesSection.style.display === 'block';
                    
                    if (isInFavoritesView) {
                        // Exit favorites view first
                        if (typeof showMainContentView === 'function') {
                            showMainContentView();
                        }
                        // Small delay to ensure the view switches before scrolling
                        setTimeout(() => {
                            const targetId = href.substring(10); // Remove 'main.html#'
                            const targetSection = document.getElementById(targetId);
                            if (targetSection) {
                                targetSection.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start'
                                });
                            }
                        }, 100);
                    } else {
                        // Normal navigation - scroll to section
                        const targetId = href.substring(10); // Remove 'main.html#'
                        const targetSection = document.getElementById(targetId);

                        if (targetSection) {
                            targetSection.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }
                } else {
                    // On other pages, redirect to main page section
                    window.location.href = href;
                }
            }
        });
    });

    // Image carousel functionality for PC mega menu (only on main page)
    if (!isMobile && isMainPage) {
        const images = document.querySelectorAll('.promo-image');
        const indicators = document.querySelectorAll('.indicator');
        let currentSlide = 0;
        let slideInterval;

        function showSlide(index) {
            // Hide all images
            images.forEach(img => img.classList.remove('active'));
            indicators.forEach(ind => ind.classList.remove('active'));

            // Show current image
            images[index].classList.add('active');
            indicators[index].classList.add('active');
            currentSlide = index;
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % images.length;
            showSlide(currentSlide);
        }

        function startSlideshow() {
            slideInterval = setInterval(nextSlide, 3000); // Change image every 3 seconds
        }

        function stopSlideshow() {
            clearInterval(slideInterval);
        }

        // Add click handlers to indicators
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                showSlide(index);
                stopSlideshow();
                startSlideshow(); // Restart slideshow after manual change
            });
        });

        // Start slideshow when mega menu is hovered
        const megaMenu = document.querySelector('.mega-menu');
        if (megaMenu) {
            megaMenu.addEventListener('mouseenter', startSlideshow);
            megaMenu.addEventListener('mouseleave', stopSlideshow);
        }
    }

    // Add event listeners to collection cards
    const collectionCards = document.querySelectorAll('.collection-card');
    collectionCards.forEach(card => {
        card.addEventListener('click', function(event) {
            const brand = this.dataset.brand;
            if (brand) {
                event.preventDefault();
                performBrandSearch(brand);
            }
        });
    });

    // Handle window resize to switch between mobile/PC behavior
    window.addEventListener('resize', function() {
        const wasMobile = isMobile;
        const nowMobile = window.innerWidth <= 768;

        if (wasMobile !== nowMobile) {
            // Reload the page to reinitialize with new device type
            location.reload();
        }

        // Close mobile menu if switching to desktop
        if (!nowMobile && mobileNavMenu && isMenuOpen) {
            mobileNavMenu.classList.remove('active');
            isMenuOpen = false;
            if (mobileMenuToggle) {
                const lines = mobileMenuToggle.querySelectorAll('.hamburger-line');
                lines[0].style.transform = 'none';
                lines[1].style.opacity = '1';
                lines[2].style.transform = 'none';
            }
        }
    });
});

// Function to handle mega menu links on main page
function handleMegaMenuLink(linkText, href) {
    // Handle scent links - use search functionality
    const scentLinks = ['Floral', 'Woody', 'Oriental', 'Fresh', 'Citrus'];
    if (scentLinks.includes(linkText)) {
        performScentSearch(linkText);
        return;
    }
    
    // Handle brand links - use search functionality
    const brandLinks = ['Chanel', 'Dior', 'Creed', 'Tom Ford'];
    if (brandLinks.includes(linkText)) {
        performBrandSearch(linkText);
        return;
    }
    
    // Handle collection links - use search functionality
    const collectionLinks = ['Designer', 'Niche', 'Vintage', 'Seasonal'];
    if (collectionLinks.includes(linkText)) {
        performCollectionSearch(linkText);
        return;
    }
    
    // Handle customer service links - navigate to respective pages
    const customerServiceLinks = {
        'Customer Service': 'customer-service.html',
        'Contact Us': 'contact.html',
        'Size Guide': 'size-guide.html',
        'FAQ': 'faq.html',
        'Terms of Service': 'terms-of-service.html',
        'Privacy Policy': 'privacy-policy.html'
    };
    
    if (customerServiceLinks[linkText]) {
        window.location.href = customerServiceLinks[linkText];
        return;
    }
    
    // Fallback for any other links
    if (href && href.startsWith('main.html#')) {
        handleMainPageNavigation(href);
    }
}

// Function to handle mega menu links on other pages
function redirectToMainPage(linkText, href) {
    // Handle scent links
    const scentLinks = ['Floral', 'Woody', 'Oriental', 'Fresh', 'Citrus'];
    if (scentLinks.includes(linkText)) {
        window.location.href = `main.html#filter?scent=${linkText.toLowerCase()}`;
        return;
    }
    
    // Handle brand links
    const brandLinks = ['Chanel', 'Dior', 'Creed', 'Tom Ford'];
    if (brandLinks.includes(linkText)) {
        window.location.href = `main.html#filter?brand=${linkText.toLowerCase().replace(' ', '-')}`;
        return;
    }
    
    // Handle collection links
    const collectionLinks = ['Designer', 'Niche', 'Vintage', 'Seasonal'];
    if (collectionLinks.includes(linkText)) {
        window.location.href = `main.html?collection=${linkText.toLowerCase()}#filter`;
        return;
    }
    
    // Handle customer service links
    const customerServiceLinks = {
        'Customer Service': 'customer-service.html',
        'Contact Us': 'contact.html',
        'Size Guide': 'size-guide.html',
        'FAQ': 'faq.html',
        'Terms of Service': 'terms-of-service.html',
        'Privacy Policy': 'privacy-policy.html'
    };
    
    if (customerServiceLinks[linkText]) {
        window.location.href = customerServiceLinks[linkText];
        return;
    }
    
    // Fallback
    if (href) {
        window.location.href = href;
    }
}

// Function to perform scent search
function performScentSearch(scent) {
    const searchInput = document.getElementById('main-search');
    if (searchInput) {
        searchInput.value = `${scent} fragrances`;
        searchInput.focus();
        
        // Scroll to search section
        const filterSection = document.getElementById('filter');
        if (filterSection) {
            filterSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
        
        // Trigger search if performSearch function exists
        if (typeof performSearch === 'function') {
            setTimeout(() => {
                performSearch(`${scent} fragrances`);
            }, 500);
        }
    }
}

// Function to perform brand search
function performBrandSearch(brand) {
    const searchInput = document.getElementById('main-search');
    if (searchInput) {
        searchInput.value = `${brand} perfume`;
        searchInput.focus();
        
        // Scroll to search section
        const filterSection = document.getElementById('filter');
        if (filterSection) {
            filterSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
        
        // Trigger search if performSearch function exists
        if (typeof performSearch === 'function') {
            setTimeout(() => {
                performSearch(`${brand} perfume`);
            }, 500);
        }
    }
}

// Function to perform collection search
function performCollectionSearch(collection) {
    const searchInput = document.getElementById('main-search');
    if (searchInput) {
        // Map collection names to search terms
        const collectionSearchTerms = {
            'Designer': 'designer perfume',
            'Niche': 'niche fragrance',
            'Vintage': 'vintage perfume',
            'Seasonal': 'seasonal fragrance'
        };
        
        const searchTerm = collectionSearchTerms[collection] || `${collection.toLowerCase()} perfume`;
        searchInput.value = searchTerm;
        searchInput.focus();
        
        // Scroll to search section
        const filterSection = document.getElementById('filter');
        if (filterSection) {
            filterSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
        
        // Trigger search if performSearch function exists
        if (typeof performSearch === 'function') {
            setTimeout(() => {
                performSearch(searchTerm);
            }, 500);
        }
    }
}

// Function to scroll to collections section
function scrollToCollections() {
    const collectionsSection = document.getElementById('collections');
    if (collectionsSection) {
        collectionsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Function to handle main page navigation with filters
function handleMainPageNavigation(href) {
    // Get URL parameters
    const urlParams = new URLSearchParams(href.split('?')[1] || '');
    const hash = href.split('#')[1] || '';

    // Handle scent filtering
    const scent = urlParams.get('scent');
    if (scent && hash.includes('filter')) {
        // Scroll to filter section and apply scent filter
        const filterSection = document.getElementById('filter');
        if (filterSection) {
            setTimeout(() => {
                filterSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                // Apply scent filter
                const searchInput = document.getElementById('main-search');
                if (searchInput) {
                    searchInput.value = scent + ' fragrances';
                    searchInput.focus();

                    // Trigger search if there's a search function
                    const searchForm = searchInput.closest('form');
                    if (searchForm) {
                        console.log('Filtering by scent:', scent);
                    }
                }
            }, 500);
        }
    }

    // Handle collection filtering
    const collectionType = urlParams.get('type');
    if (collectionType && hash.includes('collections')) {
        const collectionsSection = document.getElementById('collections');
        if (collectionsSection) {
            setTimeout(() => {
                collectionsSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                console.log('Filtering by collection type:', collectionType);
            }, 500);
        }
    }

    // Handle brand filtering
    const brand = urlParams.get('brand');
    if (brand && hash.includes('filter')) {
        const filterSection = document.getElementById('filter');
        if (filterSection) {
            setTimeout(() => {
                filterSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                console.log('Filtering by brand:', brand);
            }, 500);
        }
    }

    // Handle viral tiktok finds
    if (hash.includes('viral-tiktok-finds')) {
        const viralTikTokSection = document.getElementById('viral-tiktok-finds');
        if (viralTikTokSection) {
            setTimeout(() => {
                viralTikTokSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                console.log('Scrolled to Viral TikTok Finds section');
            }, 500);
        }
    }

    // Handle simple hash navigation (no parameters)
    if (!scent && !collectionType && !brand && hash) {
        const targetSection = document.getElementById(hash);
        if (targetSection) {
            setTimeout(() => {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 500);
        }
    }
}

// Handle filter links on page load (only for main page)
function handleFilterLinks() {
    const currentPage = window.location.pathname.split('/').pop() || 'main.html';
    const isMainPage = currentPage === 'main.html' || currentPage === 'index.html';
    
    if (!isMainPage) return;

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    console.log('handleFilterLinks triggered', { urlParams: urlParams.toString(), hash });

    // Handle scent filtering
    const scent = urlParams.get('scent');
    if (scent && hash.includes('#filter')) {
        // Scroll to filter section and apply scent filter
        const filterSection = document.getElementById('filter');
        if (filterSection) {
            setTimeout(() => {
                filterSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

                // Apply scent filter
                const searchInput = document.getElementById('main-search');
                if (searchInput) {
                    searchInput.value = scent + ' fragrances';
                    searchInput.focus();

                    // Trigger search if there's a search function
                    const searchForm = searchInput.closest('form');
                    if (searchForm) {
                        console.log('Filtering by scent:', scent);
                    }
                }
            }, 500);
        }
    }

    // Handle collection filtering
    const collection = urlParams.get('collection');
    if (collection && hash.includes('#filter')) {
        const filterSection = document.getElementById('filter');
        if (filterSection) {
            setTimeout(() => {
                filterSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                const searchInput = document.getElementById('main-search');
                if (searchInput) {
                    console.log('Applying collection filter:', collection);
                    const collectionSearchTerms = {
                        'designer': 'designer perfume',
                        'niche': 'niche fragrance',
                        'vintage': 'vintage perfume',
                        'seasonal': 'seasonal fragrance'
                    };
                    const searchTerm = collectionSearchTerms[collection] || `${collection} perfume`;
                    searchInput.value = searchTerm;
                    searchInput.focus();
                    if (typeof performSearch === 'function') {
                        performSearch(searchTerm);
                    }
                }
            }, 500);
        }
    }

    // Handle brand filtering
    const brand = urlParams.get('brand');
    if (brand && hash.includes('#filter')) {
        const filterSection = document.getElementById('filter');
        if (filterSection) {
            setTimeout(() => {
                filterSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                console.log('Filtering by brand:', brand);
            }, 500);
        }
    }

    // Handle viral tiktok finds
    if (hash.includes('#viral-tiktok-finds')) {
        const viralTikTokSection = document.getElementById('viral-tiktok-finds');
        if (viralTikTokSection) {
            setTimeout(() => {
                viralTikTokSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                console.log('Scrolled to Viral TikTok Finds section');
            }, 500);
        }
    }
}

// Handle filter links on page load
document.addEventListener('DOMContentLoaded', handleFilterLinks);

// Also handle when URL changes (for SPA-like behavior)
window.addEventListener('hashchange', handleFilterLinks);
