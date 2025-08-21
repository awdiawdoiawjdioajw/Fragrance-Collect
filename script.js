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
  RESULTS_PER_PAGE: 50,
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
        const timer = setTimeout(() => controller.abort(), 30000); // 30s timeout for health check
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

// Apply filters and sorting from UI controls
function applyFilters(isServerSide = false) {
    // Get all filter values
    currentFilters.priceRange = document.getElementById('price-filter').value;
    currentFilters.brand = document.getElementById('brand-filter').value;
    currentFilters.shipping = document.getElementById('shipping-filter').value;
    currentFilters.rating = document.getElementById('rating-filter').value;

    if (isServerSide) {
        showLoading();
        loadCJProducts(currentFilters.search, 1).then(() => {
            hideLoading();
        });
    } else {
        // For client-side filters, just re-filter and display
        filterPerfumes();
    }
}

// Sort products on the client-side
function sortProducts(products) {
    const sortByFilter = document.getElementById('sort-by-filter').value;
    const [sortBy, sortOrder] = sortByFilter.split('-');

    products.sort((a, b) => {
        if (sortBy === 'price') {
            return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
        }
        return 0; // Default case
    });

    displayProducts(products);
}

// Fetch products from the worker
async function fetchCJProducts(query = '', page = 1, limit = null, filters = {}) {
    const base = `${config.API_ENDPOINT}/products`;
    const sp = new URLSearchParams();

    const sanitizedQuery = SecurityUtils.validateSearchQuery(query);
    if (sanitizedQuery) sp.set('q', sanitizedQuery);

    // Use smart limit or fallback to config
    const finalLimit = limit || config.RESULTS_PER_PAGE;
    sp.set('limit', finalLimit.toString());
    sp.set('page', page.toString());

    // Add filters to query params
    if (filters.lowPrice) sp.set('lowPrice', filters.lowPrice);
    if (filters.highPrice) sp.set('highPrice', filters.highPrice);
    if (filters.partnerId) sp.set('partnerId', filters.partnerId);
    const url = `${base}?${sp.toString()}`;

    try {
        const startTime = Date.now();
        const controller = new AbortController();
        // Shorter timeout for GitHub Pages (15s instead of 20s)
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, {
            signal: controller.signal,
            // Add headers to help with GitHub Pages CORS
            headers: {
                'Accept': 'application/json'
            }
        });
        clearTimeout(timer);

        // Track performance metrics
        if (window.performanceMetrics) {
            window.performanceMetrics.apiCalls++;
            window.performanceMetrics.totalLoadTime += (Date.now() - startTime);
        }

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
        
        // Return the raw data structure from worker
        return data;

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

// Load products and update UI
async function loadCJProducts(query = '', page = 1) {
    try {
        // Use smart pagination based on connection speed
        const settings = getPaginationSettings();
        const limit = settings.pageSize;

        const filters = {
            lowPrice: 0,
            highPrice: 0,
            partnerId: currentFilters.brand || null
        };

        if (currentFilters.priceRange) {
            const [min, max] = currentFilters.priceRange.split('-').map(Number);
            filters.lowPrice = min;
            filters.highPrice = max || 0;
        }

        const data = await fetchCJProducts(query, page, limit, filters);

        if (data.error) {
            throw new Error(data.error);
        }

        cjProducts = mapProductsDataToItems({ products: data.products });
        totalPages = Math.ceil(data.total / limit);
        currentPage = data.page || 1;
        
        filterPerfumes(); // Centralized call to filter, which will then sort and display

        return data;
    } catch (error) {
        console.error('Error loading CJ products:', error);
        cjProducts = [];
        totalPages = 1;
        currentPage = 1;
        throw error;
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

// Performance optimization for GitHub Pages
function optimizeForGitHubPages() {
    // Detect if we're on GitHub Pages
    const isGitHubPages = location.hostname.includes('github.io');

    if (isGitHubPages) {
        console.log('Optimizing for GitHub Pages performance...');

        // Performance monitoring
        window.performanceMetrics = {
            apiCalls: 0,
            cacheHits: 0,
            totalLoadTime: 0,
            startTime: Date.now()
        };

        // Reduce prefetch cache size for GitHub Pages
        setInterval(() => {
            if (prefetchCache.size > 3) { // Even smaller cache for GitHub Pages
                const oldestKey = Array.from(prefetchCache.keys())[0];
                prefetchCache.delete(oldestKey);
            }
        }, 20000); // More frequent cleanup

        // Monitor performance
        setInterval(() => {
            const metrics = window.performanceMetrics;
            console.log('Performance Metrics:', {
                apiCalls: metrics.apiCalls,
                cacheHits: metrics.cacheHits,
                hitRate: metrics.apiCalls > 0 ? (metrics.cacheHits / metrics.apiCalls * 100).toFixed(1) + '%' : '0%',
                runtime: Date.now() - metrics.startTime + 'ms'
            });
        }, 30000);
    }
}

// Initialize the application
async function initializeApp() {
    // Apply GitHub Pages optimizations
    optimizeForGitHubPages();

    showLoading();
    const health = await checkApiHealth();
    if (!health.healthy) {
        showStatusMessage(`Error: ${health.message}`, true);
        return;
    }
    
    try {
        await loadCJProducts(config.DEFAULT_SEARCH_TERM, 1);
    } catch (error) {
        console.error("Initialization failed:", error);
    } finally {
        hideLoading();
    }
    
    displayTopRated();
    populateBrandFilter();
    addEventListeners();
    initializeExistingFeatures();
    initHamburgerMenu();
    initModal();

    // Start prefetching popular search results
    setTimeout(() => {
        startPrefetching();
    }, 2000); // Start after 2 seconds to not interfere with initial load
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

    // Fetch a curated list of popular products
    fetchCJProducts('popular fragrance', 1, 10).then(data => {
        const popularProducts = data.products || [];
        topRatedGrid.innerHTML = popularProducts.map(perfume => createProductCard(perfume)).join('');
    }).catch(error => {
        console.error('Failed to load popular products:', error);
        topRatedGrid.innerHTML = '<p>Could not load popular products at this time.</p>';
    });
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
    loadCJProducts(currentFilters.search, currentPage).then(() => {
        document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    });
}

// Create product card HTML with XSS protection
function formatShipping(perfume) {
    if (perfume.shippingCost === 0) return { text: 'Free shipping', cls: 'free' };
    if (typeof perfume.shippingCost === 'number') return { text: `$${perfume.shippingCost.toFixed(2)} shipping`, cls: '' };
    return { text: 'Unknown shipping', cls: 'unknown' };
}

function createProductCard(perfume) {
    const stars = generateStars(perfume.rating); // This will now be decorative
    const shipping = formatShipping(perfume);
    
    return `
        <div class="product-card" data-id="${perfume.id}" data-brand="${perfume.brand.toLowerCase().replace(/\s+/g, '-')}" data-price="${perfume.price}" data-rating="${perfume.rating}">
            <div class="product-image-container">
                <img src="${perfume.image || ''}" alt="${perfume.name}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x600?text=No+Image';">
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
    const sortByFilter = document.getElementById('sort-by-filter');

    if (priceFilter) {
        priceFilter.addEventListener('change', () => applyFilters(true));
    }
    const brandFilter = document.getElementById('brand-filter');
    if (brandFilter) {
        brandFilter.addEventListener('change', () => applyFilters(true));
    }

    if (ratingFilter) {
        ratingFilter.addEventListener('change', () => applyFilters(false));
    }

    if (shippingFilter) {
        shippingFilter.addEventListener('change', () => applyFilters(false));
    }

    if (sortByFilter) {
        sortByFilter.addEventListener('change', filterPerfumes);
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('main-search');
            if (searchInput) {
                const searchTerm = searchInput.value.trim();
                if (validateSearchTerm(searchTerm)) {
                    performSearch(searchTerm);
                }
            }
        });
    }

    if (mainSearch) {
        // Remove input event listener to disable search-as-you-type
        // mainSearch.addEventListener('input', (e) => {
        //     debouncedSearch(e.target.value);
        // });

        // Add Enter key support for search
        mainSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchTerm = e.target.value.trim();
                if (validateSearchTerm(searchTerm)) {
                    // Clear any pending debounced search
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    performSearch(searchTerm);
                }
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
                // No client-side filtering needed here
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

// Loading bar control functions
function showSearchLoading() {
    const loadingBar = document.getElementById('search-loading-bar');
    const progressBar = loadingBar?.querySelector('.loading-progress');
    if (loadingBar) {
        loadingBar.style.display = 'block';
        if (progressBar) {
            progressBar.style.width = '0%';
            setTimeout(() => {
                progressBar.style.width = '70%'; // Show initial progress
            }, 100);
        }
    }
}

function hideSearchLoading() {
    const loadingBar = document.getElementById('search-loading-bar');
    const progressBar = loadingBar?.querySelector('.loading-progress');
    if (loadingBar && progressBar) {
        progressBar.style.width = '100%'; // Complete the progress
        setTimeout(() => {
            loadingBar.style.display = 'none';
            progressBar.style.width = '0%'; // Reset for next use
        }, 300);
    }
}


// Filter perfumes based on current filters
function filterPerfumes() {
    SearchDebugger.logStep('Filtering products', {
        totalProducts: cjProducts.length,
        currentFilters: currentFilters
    });
    let tempProducts = [...cjProducts];
    SearchDebugger.logStep('Initial products', { count: tempProducts.length });
    
    // Rating filter (client-side)
    if (currentFilters.rating) {
        const minRating = Number(currentFilters.rating);
        const beforeCount = tempProducts.length;
        tempProducts = tempProducts.filter(p => p.rating >= minRating);
        SearchDebugger.logStep('Rating filter applied', {
            minRating: minRating,
            beforeCount: beforeCount,
            afterCount: tempProducts.length
        });
    }
    // Shipping filter (client-side)
    if (currentFilters.shipping) {
        const beforeCount = tempProducts.length;
        tempProducts = tempProducts.filter(p => matchesShipping(p, currentFilters.shipping));
        SearchDebugger.logStep('Shipping filter applied', {
            filter: currentFilters.shipping,
            beforeCount: beforeCount,
            afterCount: tempProducts.length
        });
    }
    // Search filter (client-side)
    if (currentFilters.search && currentFilters.search.trim()) {
        const beforeCount = tempProducts.length;
        tempProducts = searchWithFuzzyMatching(tempProducts, currentFilters.search.trim());
        SearchDebugger.logStep('Search filter applied', {
            searchTerm: currentFilters.search,
            beforeCount: beforeCount,
            afterCount: tempProducts.length
        });
    }
    filteredPerfumes = tempProducts;
    SearchDebugger.logStep('Final filtered products', { count: filteredPerfumes.length });
    sortProducts(filteredPerfumes);
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
    currentFilters = { brand: '', priceRange: '', rating: '', shipping: '', search: '' };

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
        'Evening Luxury': 'oud OR luxury',
        'Fresh & Floral': 'citrus OR floral',
        'Rare Finds': 'niche OR rare',
        'Artisan Creations': 'artisan OR handcrafted'
    };
    const q = themedQueries[collectionTitle] || 'fragrance';
    
    showLoading();
    loadCJProducts(q, 1).then(() => {
        hideLoading();
    });
    
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
    currentFilters = { brand: '', priceRange: '', rating: '', shipping: '', search: '' };

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
// Debounced search variables
let searchTimeout;
let lastSearchTerm = '';
let isSearching = false;

// Search analytics
const searchAnalytics = new Map();

// Search result prefetching
const prefetchCache = new Map();
const prefetchQueue = new Set();

// Debug search functionality
const SearchDebugger = {
    enabled: true,
    log: function(message, data) {
        if (!this.enabled) return;
        console.log('[Search Debug] ' + message, data);
    },
    startSearch: function(searchTerm) {
        this.log('Search started', { term: searchTerm, timestamp: Date.now() });
        this.currentSearch = {
            term: searchTerm,
            startTime: Date.now(),
            steps: []
        };
    },
    logStep: function(step, data) {
        if (!this.currentSearch) return;
        this.currentSearch.steps.push({
            step: step,
            data: data,
            timestamp: Date.now()
        });
        this.log('Step: ' + step, data);
    },
    endSearch: function(results) {
        if (!this.currentSearch) return;
        this.currentSearch.endTime = Date.now();
        this.currentSearch.duration = this.currentSearch.endTime - this.currentSearch.startTime;
        this.currentSearch.results = results;
        this.log('Search completed', {
            term: this.currentSearch.term,
            duration: this.currentSearch.duration,
            resultsCount: results?.length || 0,
            steps: this.currentSearch.steps
        });
        // Store for later analysis
        if (!window.searchHistory) window.searchHistory = [];
        window.searchHistory.push(this.currentSearch);
        this.currentSearch = null;
    },
    // Monitor state changes
    monitorState: function() {
        this.log('Current state', {
            currentFilters: currentFilters,
            cjProductsCount: cjProducts.length,
            filteredPerfumesCount: filteredPerfumes.length,
            isSearching: isSearching
        });
    },
    // Check if search term is being preserved
    validateSearchTerm: function() {
        const searchInput = document.getElementById('main-search');
        const inputValue = searchInput?.value || '';
        const filterValue = currentFilters.search || '';
        const isConsistent = inputValue.trim() === filterValue.trim();
        if (!isConsistent) {
            console.warn('[Search Debug] Search term mismatch!', {
                inputValue: inputValue,
                filterValue: filterValue,
                currentFilters: currentFilters
            });
        }
        return isConsistent;
    }
};

// Polyfill for Element.closest() method for older browsers
if (!Element.prototype.closest) {
    Element.prototype.closest = function(selector) {
        let element = this;
        while (element && element.nodeType === 1) {
            if (element.matches(selector)) {
                return element;
            }
            element = element.parentNode;
        }
        return null;
    };
}

// Polyfill for Element.matches() method for older browsers
if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector ||
                                Element.prototype.webkitMatchesSelector;
}

// Fuzzy search functionality
function fuzzyMatch(str, pattern) {
    if (!pattern) return true;
    if (!str) return false;

    const patternLower = pattern.toLowerCase();
    const strLower = str.toLowerCase();

    // Exact match gets highest priority
    if (strLower.includes(patternLower)) {
        return true;
    }

    // Simple fuzzy matching - check if all pattern characters exist in order
    let patternIndex = 0;
    for (let i = 0; i < strLower.length; i++) {
        if (strLower[i] === patternLower[patternIndex]) {
            patternIndex++;
            if (patternIndex === patternLower.length) {
                return true;
            }
        }
    }

    return false;
}

// Enhanced search with fuzzy matching
function searchWithFuzzyMatching(products, searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
        return products;
    }

    const normalizedTerm = searchTerm.toLowerCase().trim();

    return products.filter(product => {
        // Check exact matches first (highest priority)
        const nameMatch = product.name && product.name.toLowerCase().includes(normalizedTerm);
        const brandMatch = product.brand && product.brand.toLowerCase().includes(normalizedTerm);

        if (nameMatch || brandMatch) {
            return true;
        }

        // Fuzzy matching for typos and partial matches
        const nameFuzzy = product.name && fuzzyMatch(product.name, normalizedTerm);
        const brandFuzzy = product.brand && fuzzyMatch(product.brand, normalizedTerm);

        return nameFuzzy || brandFuzzy;
    }).sort((a, b) => {
        // Sort by relevance: exact matches first, then fuzzy matches
        const aExact = (a.name && a.name.toLowerCase().includes(normalizedTerm)) ||
                      (a.brand && a.brand.toLowerCase().includes(normalizedTerm));
        const bExact = (b.name && b.name.toLowerCase().includes(normalizedTerm)) ||
                      (b.brand && b.brand.toLowerCase().includes(normalizedTerm));

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Then sort by price (lower first)
        return a.price - b.price;
    });
}

// Track search queries for analytics
function trackSearchQuery(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const count = searchAnalytics.get(normalizedQuery) || 0;
    searchAnalytics.set(normalizedQuery, count + 1);

    // Log to console for debugging (remove in production)
    console.log('Search tracked:', normalizedQuery, 'Count:', count + 1);

    // Optionally send to analytics service
    // sendToAnalytics('search', { query: normalizedQuery, count: count + 1 });
}

// Get top search queries (for debugging/optimization)
function getTopSearches(limit = 10) {
    return Array.from(searchAnalytics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
}

// Search result prefetching functions
async function prefetchSearchResult(query) {
    if (prefetchCache.has(query) || prefetchQueue.has(query)) {
        return; // Already prefetched or in queue
    }

    prefetchQueue.add(query);

    try {
        const settings = getPaginationSettings();
        const data = await fetchCJProducts(query, 1, settings.pageSize);

        if (data.products && data.products.length > 0) {
            prefetchCache.set(query, data);
            console.log(`Prefetched results for: "${query}" (${data.products.length} items)`);
        }
    } catch (error) {
        console.warn(`Failed to prefetch results for "${query}":`, error);
    } finally {
        prefetchQueue.delete(query);
    }
}

// Get prefetched results
function getPrefetchedResults(query) {
    return prefetchCache.get(query);
}

// Clear old prefetch cache to prevent memory leaks
function cleanupPrefetchCache() {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [query, data] of prefetchCache.entries()) {
        if (data.timestamp && (now - data.timestamp) > maxAge) {
            prefetchCache.delete(query);
        }
    }
}

// Prefetch related queries based on current search
function prefetchRelatedQueries(currentQuery) {
    const relatedQueries = getRelatedQueries(currentQuery);
    relatedQueries.forEach((query, index) => {
        setTimeout(() => {
            prefetchSearchResult(query);
        }, index * 200 + 1000); // Stagger by 200ms, start after 1 second
    });
}

// Get related queries based on current search
function getRelatedQueries(query) {
    const normalized = query.toLowerCase().trim();
    const related = [];

    // Add common variations
    if (normalized.includes('perfume')) {
        related.push('cologne', 'fragrance', 'luxury perfume');
    }
    if (normalized.includes('cologne')) {
        related.push('perfume', 'fragrance', 'mens cologne');
    }
    if (normalized.includes('luxury')) {
        related.push('designer perfume', 'premium fragrance');
    }
    if (normalized.includes('eau de parfum')) {
        related.push('eau de toilette', 'perfume');
    }

    return related.slice(0, 3); // Limit to 3 related queries
}

// Start prefetching popular queries
function startPrefetching() {
    const popularQueries = [
        'perfume',
        'cologne',
        'fragrance',
        'luxury perfume',
        'designer fragrance',
        'eau de parfum',
        'eau de toilette'
    ];

    // Prefetch popular queries in background
    popularQueries.forEach((query, index) => {
        setTimeout(() => {
            prefetchSearchResult(query);
        }, index * 100); // Stagger requests by 100ms
    });

    // Cleanup old cache every 5 minutes
    setInterval(cleanupPrefetchCache, 5 * 60 * 1000);
}

// Smart pagination based on connection speed
function getOptimalPageSize() {
    if (typeof navigator === 'undefined') return 20; // Default for server-side

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (!connection) return 20; // Default if not supported

    const effectiveType = connection.effectiveType || '4g';

    switch (effectiveType) {
        case 'slow-2g':
            return 8;
        case '2g':
            return 10;
        case '3g':
            return 15;
        case '4g':
            return 25;
        default:
            return 20;
    }
}

// Get optimal pagination settings
function getPaginationSettings() {
    const pageSize = getOptimalPageSize();
    const prefetchThreshold = Math.max(1, Math.floor(pageSize * 0.3)); // Prefetch when 30% through current page

    return {
        pageSize,
        prefetchThreshold
    };
}

// Validate search term
function validateSearchTerm(term) {
    const trimmed = term.trim();
    return trimmed.length >= 2 && !/^\s*$/.test(trimmed);
}

// Debounced search function
function debouncedSearch(searchTerm) {
    // Clear existing timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // If search term is the same as last search, don't search again
    if (searchTerm === lastSearchTerm && searchTerm) {
        return;
    }

    // If search is too short or empty, clear results and return
    if (!validateSearchTerm(searchTerm)) {
        if (!searchTerm) {
            // Empty search - load default products
            currentFilters.search = '';
            loadCJProducts('', 1).then(() => {
                // No client-side filtering needed here
            });
            lastSearchTerm = '';
        }
        return;
    }

    // Show loading state
    showLoading();

    // Set timeout for debounced search
    searchTimeout = setTimeout(() => {
        performSearch(searchTerm);
    }, 300); // 300ms debounce delay
}

function performSearch(searchTerm) {
    SearchDebugger.startSearch(searchTerm);
    SearchDebugger.monitorState();
    if (isSearching) {
        SearchDebugger.log('Search blocked - already searching', { isSearching });
        return;
    }

    const validatedSearchTerm = SecurityUtils.validateSearchQuery(searchTerm);
    if (!validateSearchTerm(validatedSearchTerm)) {
        return;
    }
    isSearching = true;
    showSearchLoading(); // Show loading bar
    // Track search analytics
    if (validatedSearchTerm) {
        trackSearchQuery(validatedSearchTerm);
    }
    currentFilters.search = validatedSearchTerm;
    lastSearchTerm = searchTerm;
    // Check for prefetched results first
    const prefetchedData = getPrefetchedResults(validatedSearchTerm);
    if (prefetchedData) {
        SearchDebugger.logStep('Using prefetched results', {
            term: validatedSearchTerm,
            productCount: prefetchedData.products?.length || 0
        });
        cjProducts = prefetchedData.products || [];
        totalPages = Math.ceil(prefetchedData.total / getPaginationSettings().pageSize);
        currentPage = 1;
        filterPerfumes(); // This will apply client-side filters like price/rating/shipping
        hideSearchLoading(); // Hide loading bar
        isSearching = false;
        // Start prefetching related queries in background
        prefetchRelatedQueries(validatedSearchTerm);
        return;
    }
    SearchDebugger.logStep('Starting API search', { validatedTerm: validatedSearchTerm });
    // Always reload from CJ with query
    loadCJProducts(validatedSearchTerm, 1).then((data) => {
        SearchDebugger.logStep('Products loaded from API', {
            productCount: cjProducts.length,
            apiData: data
        });
        filterPerfumes();
        SearchDebugger.logStep('Products filtered', {
            filteredCount: filteredPerfumes.length
        });
        hideSearchLoading(); // Hide loading bar on success
        isSearching = false;
        SearchDebugger.endSearch(filteredPerfumes);
    }).catch(error => {
        SearchDebugger.log('Search error', { error: error.message });
        hideSearchLoading(); // Hide loading bar on error
        isSearching = false;
        SearchDebugger.endSearch([]);
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
        if (!(e.target instanceof Element)) return;
        if (e.target.closest('.product-card')) {
            const card = e.target.closest('.product-card');
            card.style.transform = 'translateY(-10px)';
        }
    }, true);
    
    document.addEventListener('mouseleave', function(e) {
        if (!(e.target instanceof Element)) return;
        if (e.target.closest('.product-card')) {
            const card = e.target.closest('.product-card');
            card.style.transform = 'translateY(0)';
        }
    }, true);

    // Collection card hover effects
    document.addEventListener('mouseenter', function(e) {
        if (!(e.target instanceof Element)) return;
        if (e.target.closest('.collection-card')) {
            const card = e.target.closest('.collection-card');
            card.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.2)';
            card.style.transform = 'translateY(-8px)';
        }
    }, true);

    document.addEventListener('mouseleave', function(e) {
        if (!(e.target instanceof Element)) return;
        if (e.target.closest('.collection-card')) {
            const card = e.target.closest('.collection-card');
            card.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.1)';
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
document.addEventListener('DOMContentLoaded', () => {
    // Polyfill for Element.closest()
    if (!Element.prototype.closest) {
        Element.prototype.closest = function (s) {
            var el = this;
            do {
                if (Element.prototype.matches.call(el, s)) return el;
                el = el.parentElement || el.parentNode;
            } while (el !== null && el.nodeType === 1);
            return null;
        };
    }

    // Polyfill for Element.matches()
    if (!Element.prototype.matches) {
        Element.prototype.matches =
            Element.prototype.msMatchesSelector ||
            Element.prototype.webkitMatchesSelector;
    }
    
    initializeApp();
});

// Check mobile menu on window resize
window.addEventListener('resize', checkMobileMenu); 
