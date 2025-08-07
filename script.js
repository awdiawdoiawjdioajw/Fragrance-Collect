// Live data only: populated from CJ via Cloudflare Worker

// Global variables
let currentFilters = {
    brand: '',
    priceRange: '',
    rating: '',
    shipping: '',
    search: ''
};

let cjProducts = [];
let filteredPerfumes = [];

// Allow overriding the API base URL (for Cloudflare Worker)
const API_BASE = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : '/api';

async function fetchCJProducts(query = '') {
    const url = `${API_BASE}/products${query ? `?q=${encodeURIComponent(query)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CJ fetch failed (${res.status})`);
    const data = await res.json();
    const items = (data.products || []).map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand || 'Unknown',
        price: p.price || 0,
        rating: p.rating || 0,
        image: p.image,
        description: p.description || '',
        buyUrl: p.cjLink,
        shippingCost: typeof p.shippingCost === 'number' ? p.shippingCost : null,
        isReal: true
    }));
    return items;
}

function sortWithFreeShippingPriority(list) {
    return list.sort((a, b) => {
        if (a.price === b.price) {
            const aFree = a.shippingCost === 0 ? 1 : 0;
            const bFree = b.shippingCost === 0 ? 1 : 0;
            return bFree - aFree;
        }
        return a.price - b.price;
    });
}

async function loadCJProducts(query = '') {
    try {
        const items = await fetchCJProducts(query);
        cjProducts = sortWithFreeShippingPriority(items);
    } catch (e) {
        console.error('CJ load failed:', e);
        cjProducts = [];
    }
}

async function loadCJProductsMulti(queries) {
    const results = await Promise.allSettled(queries.map(q => fetchCJProducts(q)));
    const map = new Map();
    results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            r.value.forEach(p => map.set(p.id, p));
        }
    });
    cjProducts = sortWithFreeShippingPriority(Array.from(map.values()));
}

// Initialize the application
async function initializeApp() {
    await loadCJProducts('perfume fragrance cologne');
    if (!cjProducts.length) {
        await loadCJProductsMulti(['perfume','cologne','eau de parfum','eau de toilette']);
    }
    filteredPerfumes = [...cjProducts];
    displayProducts(filteredPerfumes);
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
        const totalProducts = cjProducts.length;
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
    
    const topRated = [...cjProducts]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 4);
    
    topRatedGrid.innerHTML = topRated.map(perfume => createProductCard(perfume)).join('');
}

// Create product card HTML
function formatShipping(perfume) {
    if (perfume.shippingCost === 0) return { text: 'Free shipping', cls: 'free' };
    if (typeof perfume.shippingCost === 'number') return { text: `$${perfume.shippingCost.toFixed(2)} shipping`, cls: '' };
    return { text: 'Unknown shipping', cls: 'unknown' };
}

function createProductCard(perfume) {
    const stars = generateStars(perfume.rating);
    const shipping = formatShipping(perfume);
    return `
        <div class="product-card" data-id="${perfume.id}" data-brand="${perfume.brand.toLowerCase().replace(/\s+/g, '-')}" data-price="${perfume.price}" data-rating="${perfume.rating}">
            <div class="product-image">
                <img src="${perfume.image}" alt="${perfume.name}">
                <div class="product-overlay">
                    ${perfume.buyUrl ? `<a class="view-details-btn" href="${perfume.buyUrl}" target="_blank" rel="nofollow sponsored noopener">Buy Now</a>` : `<button class=\"view-details-btn\" data-perfume-id=\"${perfume.id}\">View Details</button>`}
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${perfume.name}</h3>
                <p class="product-brand">${perfume.brand}</p>
                <div class="product-rating">
                    ${stars}
                    <span class="rating-text">(${perfume.rating})</span>
                </div>
                <div class="product-price-container">
                    <p class="product-price">$${perfume.price}</p>
                    <span class="shipping-badge ${shipping.cls}">${shipping.text}</span>
                </div>
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
    
    brandFilter.innerHTML = '<option value="">All Brands</option>';
    const brands = [...new Set(cjProducts.map(perfume => perfume.brand))].filter(Boolean).sort();
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
    const shippingFilter = document.getElementById('shipping-filter');
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
    if (shippingFilter) {
        shippingFilter.addEventListener('change', applyFilters);
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
        const target = e.target;
        if (target.classList.contains('view-details-btn')) {
            const idAttr = target.getAttribute('data-perfume-id');
            if (idAttr) {
                e.preventDefault();
                const perfume = cjProducts.find(p => String(p.id) === String(idAttr));
                if (perfume) {
                    showPerfumeDetails(perfume);
                }
            }
            // If no data-perfume-id, this is a Buy Now link; allow default navigation
        }
    });
}

// Apply filters
function applyFilters() {
    const brandFilter = document.getElementById('brand-filter');
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');
    
    currentFilters.brand = brandFilter ? brandFilter.value : '';
    currentFilters.priceRange = priceFilter ? priceFilter.value : '';
    currentFilters.rating = ratingFilter ? ratingFilter.value : '';
    currentFilters.shipping = shippingFilter ? shippingFilter.value : '';
    
    filterPerfumes();
}

// Filter perfumes based on current filters
function matchesShipping(perfume, filterVal) {
    if (!filterVal) return true;
    const cost = typeof perfume.shippingCost === 'number' ? perfume.shippingCost : null;
    switch (filterVal) {
        case 'free':
            return cost === 0;
        case 'unknown':
            return cost === null;
        case '20+':
            return cost !== null && cost >= 20;
        default: {
            const [minStr, maxStr] = filterVal.split('-');
            const min = Number(minStr);
            const max = maxStr ? Number(maxStr) : null;
            if (cost === null) return false;
            if (max === null) return cost >= min;
            return cost >= min && cost <= max;
        }
    }
}

function filterPerfumes() {
    filteredPerfumes = cjProducts.filter(perfume => {
        // Brand filter
        if (currentFilters.brand && perfume.brand.toLowerCase().replace(/\s+/g, '-') !== currentFilters.brand) {
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
        // Shipping filter
        if (!matchesShipping(perfume, currentFilters.shipping)) {
            return false;
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
    
    // Sort with free shipping priority on price ties
    filteredPerfumes.sort((a, b) => {
        if (a.price === b.price) {
            const aFree = a.shippingCost === 0 ? 1 : 0;
            const bFree = b.shippingCost === 0 ? 1 : 0;
            return bFree - aFree;
        }
        return a.price - b.price;
    });

    displayProducts(filteredPerfumes);
}

// Filter by collection type
async function filterByCollection(collectionTitle) {
    // Clear existing filters
    currentFilters = { brand: '', priceRange: '', rating: '', shipping: '', search: '' };

    // Reset filter dropdowns
    const brandFilter = document.getElementById('brand-filter');
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');
    const mainSearch = document.getElementById('main-search');
    if (brandFilter) brandFilter.value = '';
    if (priceFilter) priceFilter.value = '';
    if (ratingFilter) ratingFilter.value = '';
    if (shippingFilter) shippingFilter.value = '';
    if (mainSearch) mainSearch.value = '';

    // Live themed fetch
    const themedQueries = {
        'Evening Luxury': ['luxury perfume', 'amber oud night', 'evening cologne'],
        'Fresh & Floral': ['fresh floral perfume', 'jasmine rose citrus', 'spring fragrance'],
        'Rare Finds': ['exclusive limited niche perfume', 'rare niche fragrance'],
        'Artisan Creations': ['artisan handcrafted indie perfume', 'small batch fragrance']
    };
    const q = themedQueries[collectionTitle];
    if (q) {
        await loadCJProductsMulti(q);
    } else {
        await loadCJProducts('perfume fragrance cologne');
    }
    const filteredResults = [...cjProducts];

    filteredPerfumes = filteredResults;
    displayProducts(filteredPerfumes);

    const searchResultsInfo = document.getElementById('search-results-info');
    if (searchResultsInfo) {
        const totalProducts = cjProducts.length;
        const foundProducts = filteredResults.length;
        searchResultsInfo.innerHTML = `<p>Showing ${foundProducts} of ${totalProducts} fragrances in "${collectionTitle}" collection</p>`;
        searchResultsInfo.style.display = 'block';
    }
}

// Clear all filters
function clearFilters() {
    const brandFilter = document.getElementById('brand-filter');
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');
    const mainSearch = document.getElementById('main-search');
    
    if (brandFilter) brandFilter.value = '';
    if (priceFilter) priceFilter.value = '';
    if (ratingFilter) ratingFilter.value = '';
    if (shippingFilter) shippingFilter.value = '';
    if (mainSearch) mainSearch.value = '';
    
    currentFilters = { brand: '', priceRange: '', rating: '', shipping: '', search: '' };
    
    filteredPerfumes = [...cjProducts];
    displayProducts(filteredPerfumes);
}

// Perform search
function performSearch() {
    const searchInput = document.getElementById('main-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim();
    currentFilters.search = searchTerm;
    // Always reload from CJ with query
    loadCJProducts(searchTerm).then(() => {
        filterPerfumes();
    });
    
    // Scroll to shop section if search is performed and we're not already there
    if (searchTerm && !isElementInViewport(document.getElementById('shop'))) {
        document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    }
    
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
    const modalBtn = document.querySelector('.modal-btn');
    
    if (modal && modalImage && modalName && modalBrand && modalRating && modalDescription && modalPrice) {
        modalImage.src = perfume.image;
        modalImage.alt = perfume.name;
        modalName.textContent = perfume.name;
        modalBrand.textContent = perfume.brand;
        modalRating.innerHTML = generateStars(perfume.rating) + ` <span class="rating-text">(${perfume.rating})</span>`;
        modalDescription.textContent = perfume.description || '';
        modalPrice.textContent = `$${perfume.price}`;
        if (modalBtn) {
            if (perfume.buyUrl) {
                modalBtn.textContent = 'Buy from retailer';
                modalBtn.onclick = () => window.open(perfume.buyUrl, '_blank', 'noopener');
                modalBtn.style.display = 'inline-block';
            } else {
                modalBtn.style.display = 'none';
            }
        }
        
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

// Desktop-like mobile navigation - keep navigation visible
function checkMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger');
    
    // Always keep navigation visible like desktop
    if (navMenu) {
        navMenu.style.position = 'static';
        navMenu.style.left = '0';
        navMenu.style.top = 'auto';
        navMenu.style.width = 'auto';
        navMenu.style.height = 'auto';
        navMenu.style.display = 'flex';
        navMenu.style.flexDirection = 'row';
        navMenu.style.background = 'none';
        navMenu.style.boxShadow = 'none';
        navMenu.style.border = 'none';
        navMenu.style.zIndex = 'auto';
        navMenu.classList.remove('active');
    }
    
    // Hide hamburger menu since we're keeping desktop navigation
    if (hamburger) {
        hamburger.style.display = 'none';
        hamburger.classList.remove('active');
    }
}

// Simplified mobile navigation - no hamburger needed
function initHamburgerMenu() {
    // Since we're keeping desktop navigation visible, no hamburger functionality needed
    // Just ensure navigation is always visible
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        navMenu.style.display = 'flex';
        navMenu.style.flexDirection = 'row';
        navMenu.style.position = 'static';
        navMenu.style.background = 'none';
        navMenu.style.boxShadow = 'none';
        navMenu.style.border = 'none';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // Always ensure navigation is visible (desktop-like on all devices)
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger');
    
    if (navMenu) {
        navMenu.style.display = 'flex';
        navMenu.style.flexDirection = 'row';
        navMenu.style.position = 'static';
        navMenu.style.background = 'none';
        navMenu.style.boxShadow = 'none';
        navMenu.style.border = 'none';
        navMenu.style.zIndex = 'auto';
        navMenu.style.left = '0';
        navMenu.style.top = 'auto';
        navMenu.style.width = 'auto';
        navMenu.style.height = 'auto';
    }
    
    // Always hide hamburger since we're keeping desktop navigation
    if (hamburger) {
        hamburger.style.display = 'none';
        hamburger.classList.remove('active');
    }
    
    checkMobileMenu();
});

// Check mobile menu on window resize
window.addEventListener('resize', checkMobileMenu); 