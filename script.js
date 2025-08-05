// Mock perfume data
const perfumeData = [
    {
        id: 1,
        name: "Midnight Rose",
        brand: "Maison de Luxe",
        price: 285,
        rating: 4.9,
        image: "https://images.unsplash.com/photo-1541643600914-78b084683601?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "A sophisticated blend of dark roses and midnight jasmine"
    },
    {
        id: 2,
        name: "Vanilla Dreams",
        brand: "Parfum Élégant",
        price: 320,
        rating: 4.8,
        image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Luxurious vanilla with hints of caramel and sandalwood"
    },
    {
        id: 3,
        name: "Ocean Breeze",
        brand: "Aqua Fragrances",
        price: 195,
        rating: 4.2,
        image: "https://images.unsplash.com/photo-1592945403244-b3faa5b613b0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Fresh oceanic notes with marine accords"
    },
    {
        id: 4,
        name: "Golden Amber",
        brand: "Oriental Scents",
        price: 450,
        rating: 4.7,
        image: "https://images.unsplash.com/photo-1615639164213-aab04da93c7c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Rich amber with golden spices and oud"
    },
    {
        id: 5,
        name: "Lavender Fields",
        brand: "Provence Parfums",
        price: 165,
        rating: 4.3,
        image: "https://images.unsplash.com/photo-1588405748880-12d1d1a6d4a1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Pure lavender essence from Provence fields"
    },
    {
        id: 6,
        name: "Mystic Woods",
        brand: "Forest Essence",
        price: 380,
        rating: 4.6,
        image: "https://images.unsplash.com/photo-1590736969955-71cc94901354?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Deep forest notes with moss and cedar"
    },
    {
        id: 7,
        name: "Royal Jasmine",
        brand: "Maison de Luxe",
        price: 520,
        rating: 4.9,
        image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Exquisite jasmine with royal oud and musk"
    },
    {
        id: 8,
        name: "Citrus Sunrise",
        brand: "Aqua Fragrances",
        price: 180,
        rating: 4.1,
        image: "https://images.unsplash.com/photo-1592945403244-b3faa5b613b0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Bright citrus blend with morning dew"
    },
    {
        id: 9,
        name: "Velvet Orchid",
        brand: "Oriental Scents",
        price: 395,
        rating: 4.5,
        image: "https://images.unsplash.com/photo-1615639164213-aab04da93c7c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Luxurious orchid with velvet undertones"
    },
    {
        id: 10,
        name: "Sandalwood Serenity",
        brand: "Forest Essence",
        price: 275,
        rating: 4.4,
        image: "https://images.unsplash.com/photo-1590736969955-71cc94901354?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Peaceful sandalwood with meditation notes"
    },
    {
        id: 11,
        name: "Rose Garden",
        brand: "Provence Parfums",
        price: 220,
        rating: 4.3,
        image: "https://images.unsplash.com/photo-1588405748880-12d1d1a6d4a1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Romantic rose garden in full bloom"
    },
    {
        id: 12,
        name: "Diamond Dust",
        brand: "Maison de Luxe",
        price: 650,
        rating: 5.0,
        image: "https://images.unsplash.com/photo-1587017539504-67cfbddac569?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80",
        description: "Exclusive diamond-infused fragrance"
    }
];

// Global variables
let currentFilters = {
    brand: '',
    priceRange: '',
    rating: '',
    search: ''
};

let filteredPerfumes = [...perfumeData];

// Initialize the application
function initializeApp() {
    displayProducts(perfumeData);
    displayTopRated();
    populateBrandFilter();
    addEventListeners();
    initializeExistingFeatures();
    initHamburgerMenu();
    initModal();
}

// Display products in the grid
function displayProducts(perfumes) {
    const productsGrid = document.getElementById('products-grid');
    const noResults = document.getElementById('no-results');
    const searchResultsInfo = document.getElementById('search-results-info');
    
    if (!productsGrid) return;
    
    if (perfumes.length === 0) {
        productsGrid.innerHTML = '';
        noResults.style.display = 'block';
        if (searchResultsInfo) searchResultsInfo.style.display = 'none';
        return;
    }
    
    noResults.style.display = 'none';
    
    // Show search results count if there's an active search
    if (currentFilters.search && searchResultsInfo) {
        const totalProducts = perfumeData.length;
        const foundProducts = perfumes.length;
        searchResultsInfo.innerHTML = `
            <p>Found ${foundProducts} of ${totalProducts} fragrances for "${currentFilters.search}"</p>
        `;
        searchResultsInfo.style.display = 'block';
    } else if (searchResultsInfo) {
        searchResultsInfo.style.display = 'none';
    }
    
    productsGrid.innerHTML = perfumes.map(perfume => createProductCard(perfume)).join('');
}

// Display top rated products
function displayTopRated() {
    const topRatedGrid = document.getElementById('top-rated-grid');
    if (!topRatedGrid) return;
    
    const topRated = perfumeData
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 4);
    
    topRatedGrid.innerHTML = topRated.map(perfume => createProductCard(perfume)).join('');
}

// Create product card HTML
function createProductCard(perfume) {
    const stars = generateStars(perfume.rating);
    return `
        <div class="product-card" data-id="${perfume.id}" data-brand="${perfume.brand.toLowerCase().replace(/\s+/g, '-')}" data-price="${perfume.price}" data-rating="${perfume.rating}">
            <div class="product-image">
                <img src="${perfume.image}" alt="${perfume.name}">
                <div class="product-overlay">
                    <button class="view-details-btn" data-perfume-id="${perfume.id}">View Details</button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${perfume.name}</h3>
                <p class="product-brand">${perfume.brand}</p>
                <div class="product-rating">
                    ${stars}
                    <span class="rating-text">(${perfume.rating})</span>
                </div>
                <p class="product-price">$${perfume.price}</p>
            </div>
        </div>
    `;
}

// Generate star rating HTML
function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    let starsHTML = '';
    
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<i class="fas fa-star"></i>';
    }
    
    if (hasHalfStar) {
        starsHTML += '<i class="fas fa-star-half-alt"></i>';
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<i class="far fa-star"></i>';
    }
    
    return starsHTML;
}

// Populate brand filter options
function populateBrandFilter() {
    const brandFilter = document.getElementById('brand-filter');
    if (!brandFilter) return;
    
    const brands = [...new Set(perfumeData.map(perfume => perfume.brand))];
    brands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand.toLowerCase().replace(/\s+/g, '-');
        option.textContent = brand;
        brandFilter.appendChild(option);
    });
}

// Add event listeners
function addEventListeners() {
    // Filter event listeners
    const brandFilter = document.getElementById('brand-filter');
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const mainSearch = document.getElementById('main-search');
    const searchBtn = document.querySelector('.search-btn');
    const browseFragrancesBtn = document.getElementById('browse-fragrances');
    
    if (brandFilter) {
        brandFilter.addEventListener('change', applyFilters);
    }
    
    if (priceFilter) {
        priceFilter.addEventListener('change', applyFilters);
    }
    
    if (ratingFilter) {
        ratingFilter.addEventListener('change', applyFilters);
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }
    
    if (mainSearch) {
        mainSearch.addEventListener('input', performSearch);
        // Add Enter key support for search
        mainSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
        // Show/hide clear button based on input
        mainSearch.addEventListener('input', function() {
            const clearBtn = document.getElementById('clear-search');
            if (clearBtn) {
                clearBtn.style.display = this.value.trim() ? 'block' : 'none';
            }
        });
    }
    
    // Clear search button functionality
    const clearSearchBtn = document.getElementById('clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            const mainSearch = document.getElementById('main-search');
            if (mainSearch) {
                mainSearch.value = '';
                mainSearch.focus();
                this.style.display = 'none';
                currentFilters.search = '';
                filterPerfumes();
            }
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            performSearch();
        });
    }
    
    if (browseFragrancesBtn) {
        browseFragrancesBtn.addEventListener('click', () => {
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // Collection Explore buttons functionality
    const collectionButtons = document.querySelectorAll('.collection-btn');
    collectionButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the collection name from the parent card
            const collectionCard = this.closest('.collection-card');
            const collectionTitle = collectionCard.querySelector('h3').textContent;
            
            // Navigate to shop section
            const shopSection = document.getElementById('shop');
            if (shopSection) {
                shopSection.scrollIntoView({ behavior: 'smooth' });
                
                // Filter products based on collection type
                setTimeout(() => {
                    filterByCollection(collectionTitle);
                }, 500);
            }
        });
    });
    
    // Product card event listeners
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('view-details-btn')) {
            e.preventDefault();
            const perfumeId = parseInt(e.target.getAttribute('data-perfume-id'));
            const perfume = perfumeData.find(p => p.id === perfumeId);
            
            if (perfume) {
                showPerfumeDetails(perfume);
            }
        }
    });
}

// Apply filters
function applyFilters() {
    const brandFilter = document.getElementById('brand-filter');
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    
    currentFilters.brand = brandFilter ? brandFilter.value : '';
    currentFilters.priceRange = priceFilter ? priceFilter.value : '';
    currentFilters.rating = ratingFilter ? ratingFilter.value : '';
    
    filterPerfumes();
}

// Filter perfumes based on current filters
function filterPerfumes() {
    filteredPerfumes = perfumeData.filter(perfume => {
        // Brand filter
        if (currentFilters.brand && perfume.brand !== currentFilters.brand) {
            return false;
        }
        
        // Price range filter
        if (currentFilters.priceRange) {
            const [min, max] = currentFilters.priceRange.split('-').map(Number);
            if (max && (perfume.price < min || perfume.price > max)) {
                return false;
            } else if (!max && perfume.price < min) {
                return false;
            }
        }
        
        // Rating filter
        if (currentFilters.rating) {
            const minRating = parseInt(currentFilters.rating);
            if (perfume.rating < minRating) {
                return false;
            }
        }
        
        // Search filter
        if (currentFilters.search) {
            const searchTerm = currentFilters.search.toLowerCase();
            const matchesName = perfume.name.toLowerCase().includes(searchTerm);
            const matchesBrand = perfume.brand.toLowerCase().includes(searchTerm);
            const matchesDescription = perfume.description.toLowerCase().includes(searchTerm);
            
            if (!matchesName && !matchesBrand && !matchesDescription) {
                return false;
            }
        }
        
        return true;
    });
    
    displayProducts(filteredPerfumes);
}

// Filter by collection type
function filterByCollection(collectionTitle) {
    // Clear existing filters
    currentFilters = {
        brand: '',
        priceRange: '',
        rating: '',
        search: ''
    };
    
    // Reset filter dropdowns
    const brandFilter = document.getElementById('brand-filter');
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const mainSearch = document.getElementById('main-search');
    
    if (brandFilter) brandFilter.value = '';
    if (priceFilter) priceFilter.value = '';
    if (ratingFilter) ratingFilter.value = '';
    if (mainSearch) mainSearch.value = '';
    
    // Filter based on collection type
    let filteredResults = [];
    
    switch(collectionTitle) {
        case 'Evening Luxury':
            // Filter for sophisticated, luxury fragrances (higher price, higher rating)
            filteredResults = perfumeData.filter(perfume => 
                perfume.price >= 200 && perfume.rating >= 4.0
            );
            break;
        case 'Fresh & Floral':
            // Filter for fresh, floral fragrances (look for keywords in description)
            filteredResults = perfumeData.filter(perfume => 
                perfume.description.toLowerCase().includes('fresh') ||
                perfume.description.toLowerCase().includes('floral') ||
                perfume.description.toLowerCase().includes('light') ||
                perfume.description.toLowerCase().includes('spring')
            );
            break;
        case 'Rare Finds':
            // Filter for exclusive, limited edition fragrances (higher price, unique brands)
            filteredResults = perfumeData.filter(perfume => 
                perfume.price >= 300 || 
                perfume.description.toLowerCase().includes('exclusive') ||
                perfume.description.toLowerCase().includes('limited') ||
                perfume.description.toLowerCase().includes('rare')
            );
            break;
        case 'Artisan Creations':
            // Filter for handcrafted, artisan fragrances
            filteredResults = perfumeData.filter(perfume => 
                perfume.description.toLowerCase().includes('artisan') ||
                perfume.description.toLowerCase().includes('handcrafted') ||
                perfume.description.toLowerCase().includes('master') ||
                perfume.description.toLowerCase().includes('crafted')
            );
            break;
        default:
            filteredResults = [...perfumeData];
    }
    
    // Update the display
    filteredPerfumes = filteredResults;
    displayProducts(filteredPerfumes);
    
    // Show collection filter message
    const searchResultsInfo = document.getElementById('search-results-info');
    if (searchResultsInfo) {
        const totalProducts = perfumeData.length;
        const foundProducts = filteredResults.length;
        searchResultsInfo.innerHTML = `
            <p>Showing ${foundProducts} of ${totalProducts} fragrances in "${collectionTitle}" collection</p>
        `;
        searchResultsInfo.style.display = 'block';
    }
}

// Clear all filters
function clearFilters() {
    const brandFilter = document.getElementById('brand-filter');
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const mainSearch = document.getElementById('main-search');
    
    if (brandFilter) brandFilter.value = '';
    if (priceFilter) priceFilter.value = '';
    if (ratingFilter) ratingFilter.value = '';
    if (mainSearch) mainSearch.value = '';
    
    currentFilters = {
        brand: '',
        priceRange: '',
        rating: '',
        search: ''
    };
    
    filteredPerfumes = [...perfumeData];
    displayProducts(filteredPerfumes);
}

// Perform search
function performSearch() {
    const searchInput = document.getElementById('main-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim();
    currentFilters.search = searchTerm;
    
    // Scroll to shop section if search is performed and we're not already there
    if (searchTerm && !isElementInViewport(document.getElementById('shop'))) {
        document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    }
    
    filterPerfumes();
    
    // Add visual feedback for search
    if (searchTerm) {
        const searchBtn = document.querySelector('.search-btn');
        if (searchBtn) {
            searchBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                searchBtn.style.transform = 'scale(1)';
            }, 150);
        }
    }
}

// Helper function to check if element is in viewport
function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Initialize existing features
function initializeExistingFeatures() {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navbar background change on scroll
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            navbar.style.background = 'rgba(18, 18, 18, 0.98)';
            navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(18, 18, 18, 0.95)';
            navbar.style.boxShadow = 'none';
        }
    });

    // Product card hover effects
    document.addEventListener('mouseenter', function(e) {
        if (e.target.closest('.product-card')) {
            const card = e.target.closest('.product-card');
            card.style.transform = 'translateY(-10px)';
        }
    }, true);
    
    document.addEventListener('mouseleave', function(e) {
        if (e.target.closest('.product-card')) {
            const card = e.target.closest('.product-card');
            card.style.transform = 'translateY(0)';
        }
    }, true);

    // Collection card hover effects
    document.addEventListener('mouseenter', function(e) {
        if (e.target.closest('.collection-card')) {
            const card = e.target.closest('.collection-card');
            card.style.transform = 'translateY(-5px)';
        }
    }, true);
    
    document.addEventListener('mouseleave', function(e) {
        if (e.target.closest('.collection-card')) {
            const card = e.target.closest('.collection-card');
            card.style.transform = 'translateY(0)';
        }
    }, true);
}

// Show perfume details in modal
function showPerfumeDetails(perfume) {
    const modal = document.getElementById('perfume-modal');
    const modalImage = document.getElementById('modal-perfume-image');
    const modalName = document.getElementById('modal-perfume-name');
    const modalBrand = document.getElementById('modal-perfume-brand');
    const modalRating = document.getElementById('modal-perfume-rating');
    const modalDescription = document.getElementById('modal-perfume-description');
    const modalPrice = document.getElementById('modal-perfume-price');
    
    if (modal && modalImage && modalName && modalBrand && modalRating && modalDescription && modalPrice) {
        modalImage.src = perfume.image;
        modalImage.alt = perfume.name;
        modalName.textContent = perfume.name;
        modalBrand.textContent = perfume.brand;
        modalRating.innerHTML = generateStars(perfume.rating) + ` <span class="rating-text">(${perfume.rating})</span>`;
        modalDescription.textContent = perfume.description;
        modalPrice.textContent = `$${perfume.price}`;
        
        modal.style.display = 'flex';
    }
}

// Initialize modal functionality
function initModal() {
    const modal = document.getElementById('perfume-modal');
    const closeBtn = document.querySelector('.close');
    
    if (modal && closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// Mobile menu functionality
function checkMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger');
    
    if (window.innerWidth <= 768) {
        // Mobile: ensure hamburger is visible and nav menu uses CSS positioning
        if (hamburger) {
            hamburger.style.display = 'flex';
        }
        if (navMenu) {
            // Don't override CSS positioning, just ensure it's not active
            navMenu.classList.remove('active');
        }
    } else {
        // Desktop: show nav menu normally, hide hamburger
        if (navMenu) {
            navMenu.style.display = 'flex';
            navMenu.style.left = '0';
            navMenu.classList.remove('active');
        }
        if (hamburger) {
            hamburger.style.display = 'none';
            hamburger.classList.remove('active');
        }
    }
}

// Hamburger menu toggle
function initHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    // Ensure navigation is visible on desktop
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger');
    
    // Set initial state based on screen size
    if (window.innerWidth > 768) {
        // Desktop: ensure nav menu is visible
        if (navMenu) {
            navMenu.style.display = 'flex';
            navMenu.style.left = '0';
        }
        if (hamburger) {
            hamburger.style.display = 'none';
        }
    } else {
        // Mobile: let CSS handle the positioning
        if (hamburger) {
            hamburger.style.display = 'flex';
        }
    }
    
    checkMobileMenu();
});

// Check mobile menu on window resize
window.addEventListener('resize', checkMobileMenu); 