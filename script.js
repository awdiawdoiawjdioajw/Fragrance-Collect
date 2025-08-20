// Live data only: populated from CJ via Cloudflare Worker

// Security utilities for XSS prevention
const SecurityUtils = {
  // HTML entity encoding to prevent XSS
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // Validate and sanitize search queries
  validateSearchQuery(query) {
    if (!query || typeof query !== 'string') return '';
    
    // Remove potentially dangerous characters
    let sanitized = query.replace(/[<>\"'&]/g, '');
    
    // Only allow alphanumeric, spaces, and safe punctuation
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-.,&()]/g, '');
    
    // Limit length
    return sanitized.substring(0, 200).trim();
  },

  // Validate numeric inputs
  validateNumber(value, min = 0, max = Infinity, defaultValue = 0) {
    const num = Number(value);
    return isNaN(num) || num < min || num > max ? defaultValue : num;
  },

  // Validate URLs
  validateUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    try {
      const urlObj = new URL(url);
      // Only allow HTTPS URLs
      if (urlObj.protocol !== 'https:') return '';
      return url;
    } catch {
      return '';
    }
  },

  // Safe DOM manipulation
  setInnerHTML(element, content) {
    if (!element || !content) return;
    
    // Use textContent for safety, or create safe HTML
    if (typeof content === 'string' && content.includes('<')) {
      // If content contains HTML, sanitize it
      element.innerHTML = this.escapeHtml(content);
    } else {
      element.textContent = content;
    }
  }
};

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
let availableFeeds = [];
let currentPage = 1;
let totalPages = 1;

// Configuration
const config = {
  // --- IMPORTANT ---
  // PASTE YOUR CLOUDFLARE WORKER URL HERE
  API_ENDPOINT: 'https://weathered-mud-6ed5.joshuablaszczyk.workers.dev', 
  DEFAULT_SEARCH_TERM: 'fragrance',
  RESULTS_PER_PAGE: 20,
};

function showStatusMessage(message, isError = false) {
    const grid = document.getElementById('products-grid');
    const noResults = document.getElementById('no-results');
    if (grid) grid.innerHTML = '';
    if (noResults) {
        noResults.style.display = 'block';
        // Use safe DOM manipulation
        SecurityUtils.setInnerHTML(noResults, message);
        noResults.style.color = isError ? '#ffb4b4' : '';
    }
}

function showLoading() { showStatusMessage('Loading products...'); }
function hideLoading() {
    const noResults = document.getElementById('no-results');
    if (noResults) noResults.style.display = 'none';
}

async function checkApiHealth() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${config.API_ENDPOINT}/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
            console.error('API health check failed with status:', res.status);
            return { healthy: false, message: `API returned status ${res.status}` };
        }
        const data = await res.json().catch(() => ({}));
        console.log('API Health Check Response:', data); // Log the full response
        
        // Check if the API is responding (your worker returns { status: 'ok' })
        const isOverallHealthy = data && (data.status === 'ok' || data.ok === true);
        
        if (!isOverallHealthy) {
            return { healthy: false, message: 'Backend API is not healthy.' };
        }

        // Since your worker doesn't have a separate CJ health check,
        // we'll consider it healthy if the API responds
        return { healthy: true, message: 'API is healthy and ready to serve products.' };

    } catch (e) {
        console.error('API health check threw an error:', e);
        return { healthy: false, message: 'Could not connect to the Backend API.' };
    }
}

// SIMPLIFIED: This function is no longer needed as the new API provides clean data.
/*
function normalizeShippingLocal(cost, shippingField) {
    if (typeof cost === 'string' && cost.trim().toLowerCase() === 'free') return 0;
    if (typeof cost === 'number') return cost;
    if (shippingField && typeof shippingField === 'string') {
        if (shippingField.toLowerCase().includes('free')) return 0;
        const m = shippingField.match(/\$([0-9]+(\.[0-9]{1,2})?)/);
        if (m) return Number(m[1]);
    }
    return null;
}
*/

// SIMPLIFIED: This function now only handles the single, clean `products` array from the worker.
function mapProductsDataToItems(data) {
    if (!data || !Array.isArray(data.products)) return [];
    
    return data.products.map(p => ({
        id: SecurityUtils.escapeHtml(p.id || `cj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
        name: SecurityUtils.escapeHtml(p.name || 'Unnamed Product'),
        brand: SecurityUtils.escapeHtml(p.brand || 'Unknown Brand'),
        price: SecurityUtils.validateNumber(p.price, 0, 10000, 0),
        rating: SecurityUtils.validateNumber(p.rating, 0, 5, 0),
        image: SecurityUtils.validateUrl(p.image || ''),
        description: SecurityUtils.escapeHtml(p.description || ''),
        buyUrl: SecurityUtils.validateUrl(p.cjLink || p.buyUrl || ''),
        shippingCost: p.shippingCost, // The worker now provides this as null
        advertiser: SecurityUtils.escapeHtml(p.advertiser || 'Unknown'),
        category: SecurityUtils.escapeHtml(p.category || 'Fragrance'),
        availability: 'In Stock',
        currency: 'USD',
        isReal: true
    }));
}

// SIMPLIFIED: Fetch logic is much cleaner now.
async function fetchCJProducts(query = '', page = 1) {
    const base = `${config.API_ENDPOINT}/products`;
    const sp = new URLSearchParams();

    const sanitizedQuery = SecurityUtils.validateSearchQuery(query);
    if (sanitizedQuery) sp.set('q', sanitizedQuery);

    sp.set('limit', config.RESULTS_PER_PAGE.toString());
    sp.set('page', page.toString());

    const url = `${base}?${sp.toString()}`;
    
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000); // 20s timeout
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) {
            const errorText = await res.text();
            let errorMessage = `API fetch failed (${res.status})`;
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.details) errorMessage += `: ${SecurityUtils.escapeHtml(errorData.details)}`;
            } catch (e) {
                if (errorText && errorText.length < 100) errorMessage += `: ${SecurityUtils.escapeHtml(errorText)}`;
            }
            throw new Error(errorMessage);
        }
        
        const data = await res.json();
        if (data && data.error) {
            throw new Error(data.error + (data.details ? `: ${SecurityUtils.escapeHtml(data.details)}` : ''));
        }
        
        totalPages = Math.ceil(data.total / config.RESULTS_PER_PAGE);
        return mapProductsDataToItems(data);

    } catch (error) {
        console.error('CJ API fetch error:', error);
        showStatusMessage(`Error: Could not fetch products. ${error.message}`, true);
        return []; // Return empty array on failure
    }
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

async function loadCJProducts(query = '', page = 1) {
    try {
        const items = await fetchCJProducts(query, page);
        // If nothing returned and we know some joined advertisers exist,
        // try some brand-focused queries to increase hit rate
        if (!items.length) {
            const brandQueries = [
                'FragranceShop',
                'Fragrance Shop',
                'TikTok Shop',
                'TikTok Shop US',
                'Eau de Parfum',
                'Eau de Toilette'
            ];
            await loadCJProductsMulti(brandQueries);
            return;
        }
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
    showLoading();
    const health = await checkApiHealth();
    if (!health.healthy) {
        showStatusMessage(`Error: ${health.message}`, true);
        return;
    }
    // Set a default rating filter and load initial products
    currentFilters.rating = '5'; // Set default filter state
    await loadCJProducts('fragrance', currentPage); // Load top 50 fragrances by default
    
    // The API doesn't support rating filters, so we perform a client-side sort
    // as a substitute. Here we'll sort by price as the default.
    cjProducts.sort((a, b) => a.price - b.price);

    filteredPerfumes = [...cjProducts].filter(p => p.image && !p.name.toLowerCase().includes('banner') && !p.name.toLowerCase().includes('logo'));

    if (!filteredPerfumes.length) {
        showStatusMessage('No products found yet. Try a different search.', true);
        return;
    }
    hideLoading();
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
        // Use safe DOM manipulation
        SecurityUtils.setInnerHTML(searchResultsInfo, `Found ${foundProducts} of ${totalProducts} fragrances for "${SecurityUtils.escapeHtml(currentFilters.search)}"`);
        searchResultsInfo.style.display = 'block';
    } else if (searchResultsInfo) {
        searchResultsInfo.style.display = 'none';
    }
    
    productsGrid.innerHTML = perfumes.map(perfume => createProductCard(perfume)).join('');
    displayPagination();
    
    // Hide pagination if not needed
    const paginationContainer = document.getElementById('pagination-container');
    if (paginationContainer) {
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
        } else {
            paginationContainer.style.display = 'flex';
        }
    }
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

function displayPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    // Don't show total pages to avoid confusion with client-side filtering.
    paginationContainer.innerHTML = `
        <button id="prev-page" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        <span class="page-info">Page ${currentPage}</span>
        <button id="next-page" class="pagination-btn" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
    `;

    document.getElementById('prev-page').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('next-page').addEventListener('click', () => changePage(currentPage + 1));
}

// Change page
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    const searchTerm = document.getElementById('main-search')?.value || '';
    loadCJProducts(searchTerm, currentPage).then(() => {
        filterPerfumes();
    });
}

// Create product card HTML with XSS protection
function formatShipping(perfume) {
    if (perfume.shippingCost === 0) return { text: 'Free shipping', cls: 'free' };
    if (typeof perfume.shippingCost === 'number') return { text: `$${perfume.shippingCost.toFixed(2)} shipping`, cls: '' };
    return { text: 'Unknown shipping', cls: 'unknown' };
}

function createProductCard(perfume) {
    const stars = generateStars(perfume.rating);
    const shipping = formatShipping(perfume);
    
    // All data is already sanitized in mapProductsDataToItems
    return `
        <div class="product-card" data-id="${perfume.id}" data-brand="${perfume.brand.toLowerCase().replace(/\s+/g, '-')}" data-price="${perfume.price}" data-rating="${perfume.rating}">
            <div class="product-image-container">
                <img src="${perfume.image || ''}" alt="${perfume.name}" class="product-image" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x600?text=No+Image';">
            </div>
            <div class="product-info">
                <p class="product-brand">${perfume.brand}</p>
                <h3 class="product-name">${perfume.name}</h3>
                <div class="product-price-container">
                    <p class="product-price">$${Number(perfume.price).toFixed(2)}</p>
                    <span class="shipping-badge ${shipping.cls}">${shipping.text}</span>
                </div>
                 <div class="product-rating">
                    ${stars}
                </div>
                <a href="${perfume.buyUrl}" class="buy-now-btn" target="_blank" rel="nofollow sponsored noopener">Buy Now</a>
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
        starsHTML += '<i class="fa-solid fa-star"></i>';
    }
    
    if (hasHalfStar) {
        starsHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<i class="fa-regular fa-star"></i>';
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
        option.textContent = brand; // textContent is safe
        brandFilter.appendChild(option);
    });
}

// Add event listeners
function addEventListeners() {
    // Filter event listeners
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const mainSearch = document.getElementById('main-search');
    const searchBtn = document.querySelector('.search-btn');
    const browseFragrancesBtn = document.getElementById('browse-fragrances');

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

    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
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
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');

    currentFilters.priceRange = priceFilter ? priceFilter.value : '';
    currentFilters.rating = ratingFilter ? ratingFilter.value : '';
    currentFilters.shipping = shippingFilter ? shippingFilter.value : '';

    showLoading();
    loadCJProducts('', currentPage).then(() => {
        filterPerfumes(); // This will apply client-side filters like price/rating/shipping
        hideLoading();
    });
}

// Filter perfumes based on current filters
function filterPerfumes() {
    filteredPerfumes = cjProducts.filter(perfume => {
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
        if (currentFilters.shipping) {
            if (!matchesShipping(perfume, currentFilters.shipping)) {
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

// Helper function to check if perfume matches shipping filter
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

// Filter by collection type
async function filterByCollection(collectionTitle) {
    // Clear existing filters
    currentFilters = { priceRange: '', rating: '', shipping: '', search: '' };

    // Reset filter dropdowns
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');
    const mainSearch = document.getElementById('main-search');

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
        // Use safe DOM manipulation
        SecurityUtils.setInnerHTML(searchResultsInfo, `Showing ${foundProducts} of ${totalProducts} fragrances in "${SecurityUtils.escapeHtml(collectionTitle)}" collection`);
        searchResultsInfo.style.display = 'block';
    }
}

// Clear all filters
function clearFilters() {
    // Reset all filter select elements to their default value
    const priceFilter = document.getElementById('price-filter');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');
    const mainSearch = document.getElementById('main-search');

    if (priceFilter) priceFilter.value = '';
    if (ratingFilter) ratingFilter.value = '';
    if (shippingFilter) shippingFilter.value = '';
    if (mainSearch) mainSearch.value = '';

    // Hide the clear search button
    const clearSearchBtn = document.getElementById('clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.style.display = 'none';
    }

    // Reset the internal filters state object
    currentFilters = { priceRange: '', rating: '', shipping: '', search: '' };

    // Hide the search results informational text
    const searchResultsInfo = document.getElementById('search-results-info');
    if(searchResultsInfo) {
        searchResultsInfo.style.display = 'none';
    }

    // Show loading indicator and reload the default set of products
    showLoading();
    loadCJProducts('fragrance', currentPage).then(() => {
        filteredPerfumes = [...cjProducts];
        // Sort by price as the default criteria.
        filteredPerfumes.sort((a, b) => a.price - b.price);
        displayProducts(filteredPerfumes);
        hideLoading();
    });
}

// Perform search with input validation
function performSearch() {
    const searchInput = document.getElementById('main-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim();
    // Validate and sanitize search term
    const validatedSearchTerm = SecurityUtils.validateSearchQuery(searchTerm);
    currentFilters.search = validatedSearchTerm;
    
    // Always reload from CJ with query
    loadCJProducts(validatedSearchTerm, currentPage).then(() => {
        filterPerfumes();
    });
    
    // Scroll to shop section if search is performed and we're not already there
    if (validatedSearchTerm && !isElementInViewport(document.getElementById('shop'))) {
        document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    }
    
    // Add visual feedback for search
    if (validatedSearchTerm) {
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
        modalName.textContent = perfume.name; // textContent is safe
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
