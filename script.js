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

const currencySymbols = {
    USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', JPY: '¥', CNY: '¥'
};

// Configuration
const config = {
    API_ENDPOINT: 'https://weathered-mud-6ed5.joshuablaszczyk.workers.dev/api',
    RESULTS_PER_PAGE: 25, // Changed from original value
    DEBOUNCE_DELAY: 300,
    POPULAR_PICKS_LIMIT: 10, // New constant for popular picks
    TIKTOK_FINDS_LIMIT: 10, // New constant for TikTok finds
    PREFETCH_ENABLED: true,
    DEFAULT_SEARCH_TERM: 'fragrance perfume', // The term to search on page load
    FEATURED_FRAGRANCES: [
        'Creed Green Irish Tweed',
        'Tom Ford Ombré Leather',
        'Chanel Coco Mademoiselle',
        'Dior Sauvage'
    ]
};

// Lightweight performance metrics for optional UI cards
if (typeof window !== 'undefined' && !window.performanceMetrics) {
  window.performanceMetrics = {
    apiCalls: 0,
    totalLoadTime: 0,
    lastLoadMs: 0
  };
}

function updatePerformanceCards() {
  try {
    if (!window.performanceMetrics) return;
    const { apiCalls, totalLoadTime, lastLoadMs } = window.performanceMetrics;
    const avg = apiCalls > 0 ? Math.round(totalLoadTime / apiCalls) : 0;
    const elApi = document.getElementById('perf-api-calls');
    const elAvg = document.getElementById('perf-avg-load');
    const elLast = document.getElementById('perf-last-load');
    if (elApi) elApi.textContent = String(apiCalls);
    if (elAvg) elAvg.textContent = `${avg} ms`;
    if (elLast) elLast.textContent = `${lastLoadMs} ms`;
  } catch (e) {
    // ignore UI update errors
  }
}

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
    
    return data.products
        .map(p => ({
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
            currency: SecurityUtils.escapeHtml(p.currency || 'USD'),
            isReal: true
        }));
}

// Apply filters and sorting from UI controls
async function applyFilters(isServerSide = false) {
    try {
        // Get all filter values from the UI (safely handle missing elements)
        const priceFilter = document.getElementById('price-range');
        const brandFilter = document.getElementById('brand-filter');
        const shippingFilter = document.getElementById('shipping-filter');
        const ratingFilter = document.getElementById('rating-filter');
        
        // Debug logging
        console.log('Filter elements found:', {
            priceFilter: !!priceFilter,
            brandFilter: !!brandFilter,
            shippingFilter: !!shippingFilter,
            ratingFilter: !!ratingFilter
        });
        
        currentFilters.priceRange = priceFilter ? priceFilter.value : '';
        currentFilters.brand = brandFilter ? brandFilter.value : '';
        currentFilters.shipping = shippingFilter ? shippingFilter.value : '';
        currentFilters.rating = ratingFilter ? ratingFilter.value : '';
        
        // Server-side filters trigger a new data fetch from the worker
        if (isServerSide) {
            showLoading();
            // Always fetch from page 1 when a major filter changes
            currentPage = 1;
            const filters = buildServerFilters();
            await loadCJProducts(currentFilters.search, currentPage, null, filters);
        } else {
            // Client-side filters just refine the currently displayed products
            filterPerfumes();
        }
    } catch (error) {
        console.error('Error in applyFilters:', error);
        // Fallback: just try to load products without filters
        if (isServerSide) {
            showLoading();
            currentPage = 1;
            await loadCJProducts(currentFilters.search, currentPage);
        }
    }
}

// Sort products on the client-side
function sortProducts(products) {
    const sortByFilter = document.getElementById('sort-by-filter');
    if (!sortByFilter) {
        // If no sort filter exists, just display products without sorting
        displayProducts(products);
        return;
    }
    
    const [sortBy, sortOrder] = sortByFilter.value.split('-');

    products.sort((a, b) => {
        if (sortBy === 'price') {
            return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
        }
        return 0; // Default case
    });

    displayProducts(products);
}

/**
 * A dedicated function to fetch products from the API worker.
 * This function only handles the network request and returns the data,
 * without updating the UI directly.
 */
async function fetchProductsFromApi(query = '', page = 1, limit = null, filters = {}) {
    try {
        const sortBy = (filters && filters.sortBy) || 'revenue';
        const params = new URLSearchParams({
            q: query || '',
            page: page.toString(),
            limit: (limit || config.RESULTS_PER_PAGE).toString(),
            sortBy: sortBy,
            includeTikTok: 'true'
        });

        if (filters.lowPrice) params.append('lowPrice', filters.lowPrice.toString());
        if (filters.highPrice) params.append('highPrice', filters.highPrice.toString());
        if (filters.brand) params.append('brand', filters.brand);
        if (filters.rating) params.append('rating', filters.rating.toString());
        if (filters.partnerId) params.append('partnerId', filters.partnerId.toString());

        const apiUrl = `${config.API_ENDPOINT}/products?${params.toString()}`;
        console.log('🚀 API Fetch:', apiUrl);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(apiUrl, {
            method: 'GET',
            signal: controller.signal
        });

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
        
        return data;

    } catch (error) {
        console.error('API fetch error:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Main function to load products from CJ Affiliate.
 * It now automatically fetches multiple pages if the initial result is too small.
 */
async function loadCJProducts(query = '', page = 1, limit = null, filters = {}) {
    showLoading();
    
    try {
        const data = await fetchProductsFromApi(query, page, limit, filters);

        cjProducts = mapProductsDataToItems(data);
        filteredPerfumes = [...cjProducts];
        
        totalPages = data.total ? Math.ceil(data.total / (limit || config.RESULTS_PER_PAGE)) : 1;

        displayProducts(filteredPerfumes);
        displayPagination();
        populateBrandFilter();

        const searchResultsInfo = document.getElementById('search-results-info');
        if (searchResultsInfo) {
            const total = data.total || cjProducts.length;
            SecurityUtils.setInnerHTML(searchResultsInfo, `Showing ${cjProducts.length} of approximately ${total} results.`);
            searchResultsInfo.style.display = 'block';
        }

        return data;

    } catch (error) {
        console.error('CJ API fetch error:', error);
        showStatusMessage(`Error: Could not fetch products. ${error.message}`, true);
        return [];
    } finally {
        hideLoading();
    }
}

// Enhanced product display with revenue information
function displayProducts(perfumes) {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;

    if (perfumes.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">No products found. Try adjusting your search or filters.</p>';
        return;
    }

    const productCards = perfumes.map(perfume => createProductCard(perfume)).join('');
    productsGrid.innerHTML = productCards;

    // Add infinite scroll if enabled
    if (window.infiniteScrollEnabled) {
        // setupInfiniteScroll();
    }
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
    const filters = buildServerFilters();
    loadCJProducts(currentFilters.search, currentPage, null, filters).then(() => {
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
    const displayPrice = perfume.price.toFixed(2);
    const currencySymbol = currencySymbols[perfume.currency] || '$';

    return `
        <div class="product-card" data-id="${perfume.id}" data-brand="${perfume.brand.toLowerCase().replace(/\s+/g, '-')}" data-price="${perfume.price}" data-rating="${perfume.rating}">
            <div class="product-image-container">
                <img src="${perfume.image}" alt="${perfume.name}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/600x600?text=No+Image';">
            </div>
            <div class="product-info">
                <h3 class="product-name">${perfume.name}</h3>
                <p class="product-brand">${perfume.brand}</p>
                <div class="product-rating" role="img" aria-label="Rating: ${perfume.rating} out of 5 stars">
                    ${stars}
                    <span class="rating-number">${perfume.rating.toFixed(1)}</span>
                </div>
                <p class="product-price">${currencySymbol}${displayPrice} ${perfume.currency}</p>
            </div>
            <div class="product-meta">
                <div class="product-shipping ${shipping.cls}">${shipping.text}</div>
                <a href="${perfume.buyUrl}" target="_blank" rel="nofollow sponsored noopener" class="btn-view-deal">Shop Now <i class="fas fa-arrow-right"></i></a>
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
    if (!brandFilter) return; // Brand filter doesn't exist in this HTML
    
    brandFilter.innerHTML = '<option value="">All Brands</option>';
    const brands = [...new Set(cjProducts.map(perfume => perfume.brand))].filter(Boolean).sort();
    brands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand; // textContent is safe
        brandFilter.appendChild(option);
    });
}

// Add event listeners
function addEventListeners() {
    // Filter event listeners
    const priceFilter = document.getElementById('price-range');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const mainSearch = document.getElementById('main-search');
    const searchBtn = document.querySelector('.search-btn');
    const browseFragrancesBtn = document.getElementById('browse-fragrances');
    const sortByFilter = document.getElementById('sort-by-filter');
    const brandFilter = document.getElementById('brand-filter');
    
    if (priceFilter) {
        priceFilter.addEventListener('change', () => applyFilters(true));
    }
    
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
        // Sorting should trigger a new server-side request
        sortByFilter.addEventListener('change', () => applyFilters(true));
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // Reset dropdown filters
            document.getElementById('sort-by-filter').value = 'revenue'; // Changed from sort-by to sort-by-filter
            document.getElementById('price-range').value = 'all';
            document.getElementById('shipping-filter').value = 'all';
            document.getElementById('rating-filter').value = 'all';
            document.getElementById('brand-filter').value = '';
            
            // Reset search input to default and perform a new search
            mainSearch.value = config.DEFAULT_SEARCH_TERM;
            document.getElementById('search-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
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
        // Also handle Enter on keydown for better cross-browser support
        mainSearch.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchTerm = e.target.value.trim();
                if (validateSearchTerm(searchTerm)) {
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
    
    // Removed duplicate click handler that called performSearch() without a term
    // if (searchBtn) {
    //     searchBtn.addEventListener('click', function(e) {
    //         e.preventDefault();
    //         performSearch();
    //     });
    // }
    
    if (browseFragrancesBtn) {
        browseFragrancesBtn.addEventListener('click', () => {
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // Collection Explore buttons functionality
    const collectionButtons = document.querySelectorAll('.collection-btn');
    collectionButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            
            // Get the fragrance name from the card's h3 title
            const card = event.target.closest('.collection-card');
            const searchQuery = card.querySelector('h3').textContent.trim();

            // Reset all filters to default
            const priceRangeEl = document.getElementById('price-range');
            const shippingEl = document.getElementById('shipping-filter');
            const ratingEl = document.getElementById('rating-filter');

            if (priceRangeEl) priceRangeEl.value = 'all';
            if (shippingEl) shippingEl.value = 'all';
            if (ratingEl) ratingEl.value = 'all';

            // Removed: Setting main search input value
            // const searchInput = document.getElementById('main-search');
            // if (searchInput) {
            //     searchInput.value = searchQuery;
            // }
            document.getElementById('clear-search').style.display = 'block'; // Show clear button

            // Load the clicked collection into the "Popular Picks" section and scroll to it
            const popularPicksSection = document.getElementById('popular-picks');
            if (popularPicksSection) {
                popularPicksSection.scrollIntoView({ behavior: 'smooth' });
                loadPopularPicks(searchQuery); // Call the updated function
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
    if (currentFilters.rating && currentFilters.rating !== 'all') {
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
    if (currentFilters.shipping && currentFilters.shipping !== 'all') {
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

function buildServerFilters() {
    const filters = {};
    const priceFilter = document.getElementById('price-range');
    const brandFilter = document.getElementById('brand-filter');
    const priceRange = priceFilter ? priceFilter.value : '';
    const brand = brandFilter ? brandFilter.value : '';

    if (brand) {
        filters.brand = brand;
    }

    if (priceRange) {
        if (priceRange.includes('+')) {
            filters.lowPrice = parseInt(priceRange, 10);
        } else if (priceRange.includes('-')) {
            const [low, high] = priceRange.split('-');
            filters.lowPrice = low ? parseInt(low, 10) : null;
            filters.highPrice = high ? parseInt(high, 10) : null;
        }
    }
    return filters;
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

// Initialize dropdowns to default values
function initializeDropdowns() {
    const priceFilter = document.getElementById('price-range');
    const ratingFilter = document.getElementById('rating-filter');
    const shippingFilter = document.getElementById('shipping-filter');
    const sortByFilter = document.getElementById('sort-by-filter');

    if (priceFilter) priceFilter.value = 'all';
    if (ratingFilter) ratingFilter.value = 'all';
    if (shippingFilter) shippingFilter.value = 'all';
    if (sortByFilter) sortByFilter.value = 'revenue';
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

    // Define synonyms for special cases to make client-side search smarter
    const searchSynonyms = {
        'women': ['women', 'woman', 'female', 'femme'],
        'men': ['men', 'man', 'male', 'homme']
    };

    const termsToMatch = searchSynonyms[normalizedTerm] || [normalizedTerm];

    return products.filter(product => {
        const productNameLower = product.name ? product.name.toLowerCase() : '';
        const productBrandLower = product.brand ? product.brand.toLowerCase() : '';

        // Check if any of the terms (original or synonyms) are included
        const synonymMatch = termsToMatch.some(term => 
            productNameLower.includes(term) || productBrandLower.includes(term)
        );

        if (synonymMatch) {
            return true;
        }

        // Fuzzy matching for typos as a fallback
        const nameFuzzy = fuzzyMatch(productNameLower, normalizedTerm);
        const brandFuzzy = fuzzyMatch(productBrandLower, normalizedTerm);

        return nameFuzzy || brandFuzzy;
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
        const data = await loadCJProducts(query, 1, settings.pageSize);

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

async function performSearch(searchTerm) {
    // Fallback: if no argument provided, read from input
    if (!searchTerm) {
        const inputEl = document.getElementById('main-search');
        if (inputEl) {
            searchTerm = inputEl.value.trim();
        }
    }
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
    
    try {
        // Track search analytics
        if (validatedSearchTerm) {
            trackSearchQuery(validatedSearchTerm);
        }
        currentFilters.search = validatedSearchTerm;
        lastSearchTerm = searchTerm;
        
        // A new search is a server-side filter action
        await applyFilters(true);
    } finally {
        isSearching = false;
        hideSearchLoading();
        SearchDebugger.endSearch(filteredPerfumes);
    }
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
        
        const currencySymbol = currencySymbols[perfume.currency] || '$';
        modalPrice.textContent = `${currencySymbol}${perfume.price.toFixed(2)} ${perfume.currency}`;
        
        if (modalBtn) {
            if (perfume.buyUrl) {
                modalBtn.textContent = '✨ Visit Store & Shop Now ✨';
                modalBtn.onclick = () => window.open(perfume.buyUrl, '_blank', 'noopener,nofollow');
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

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the application
    initModal();
    checkMobileMenu();
    initHamburgerMenu();

    // Load initial products for the main grid
    const initialSearchTerm = getUrlParameter('q') || 'fragrance perfume';
    const searchInput = document.getElementById('main-search');
    if (searchInput) {
        searchInput.value = initialSearchTerm;
    }
    loadCJProducts(initialSearchTerm);

    // Load recommendation sections with their specific queries
    loadPopularPicks(); // Use a featured brand for popular picks
    loadTikTokFinds(); // Specific query for TikTok section

    // Initialize event listeners after all functions are defined
    initializeDropdowns();
    addEventListeners();
});

// Check mobile menu on window resize
window.addEventListener('resize', checkMobileMenu); 

/**
 * Populates the "Popular Picks" section.
 * @param {string} query - The search query to use for this section.
 */
async function loadPopularPicks(query) {
    const grid = document.getElementById('top-rated-grid'); // CORRECTED ID
    if (!grid) {
        console.error('Error: Popular Picks grid container not found.');
        return;
    }

    // Show a loading state
    grid.innerHTML = '<p class="loading-message">Loading popular picks...</p>';

    // Use a rotating list of luxury queries if no specific one is provided
    const luxuryQueries = [
        'Creed Aventus',
        'Baccarat Rouge 540',
        'Tom Ford Oud Wood',
        'Parfums de Marly Layton'
    ];
    const searchQuery = query || luxuryQueries[Math.floor(Math.random() * luxuryQueries.length)];
    console.log('[Debug] Loading Popular Picks with query:', searchQuery);

    try {
        const data = await fetchProductsFromApi(searchQuery, 1, config.POPULAR_PICKS_LIMIT, { sortBy: 'trending' });
        console.log('[Debug] Popular Picks API response:', data);

        if (data && data.products && data.products.length > 0) {
            console.log(`[Debug] Found ${data.products.length} popular picks.`);
            const products = mapProductsDataToItems(data);
            const productCards = products.slice(0, config.POPULAR_PICKS_LIMIT).map(p => createProductCard(p)).join('');
            grid.innerHTML = productCards;
        } else {
            console.warn('[Debug] No products found for Popular Picks.');
            grid.innerHTML = '<p class="no-products">Could not load popular picks at this time.</p>';
        }
    } catch (error) {
        console.error('Error loading popular picks:', error);
        grid.innerHTML = '<p class="no-products">Error loading popular picks.</p>';
    }
}

/**
 * Populates the "TikTok Finds" section.
 * @param {string} query - The search query to use for this section.
 */
async function loadTikTokFinds() {
    const grid = document.getElementById('tiktok-products-grid'); // CORRECTED ID
    if (!grid) {
        console.error('Error: TikTok Finds grid container not found.');
        return;
    }

    // Show a loading state
    grid.innerHTML = '<p class="loading-message">Finding TikTok trends...</p>';

    // Use a rotating list of effective TikTok queries, refined with specific keywords
    const queries = [
        'viral perfume tiktok fragrance perfume cologne',
        'trending fragrance 2024 fragrance perfume cologne',
        'tiktok famous perfume fragrance perfume cologne',
        'PerfumeTok popular scents fragrance perfume cologne',
        'viral fragrance tiktok fragrance perfume cologne',
        'trending perfume tiktok fragrance perfume cologne'
    ];
    const query = queries[Math.floor(Math.random() * queries.length)];
    console.log('[Debug] Loading TikTok Finds with query:', query);

    try {
        const data = await fetchProductsFromApi(query, 1, config.TIKTOK_FINDS_LIMIT, { partnerId: '7563286' }); // Using a specific partner ID for TikTok
        console.log('[Debug] TikTok Finds API response:', data);

        if (data && data.products && data.products.length > 0) {
            console.log(`[Debug] Found ${data.products.length} TikTok finds.`);
            const products = mapProductsDataToItems(data);
            const productCards = products.slice(0, config.TIKTOK_FINDS_LIMIT).map(p => createProductCard(p)).join('');
            grid.innerHTML = productCards;
        } else {
            console.warn('[Debug] No products found for TikTok Finds.');
            grid.innerHTML = '<p class="no-products">Could not load TikTok finds at this time.</p>';
        }
    } catch (error) {
        console.error('Error loading TikTok finds:', error);
        grid.innerHTML = '<p class="no-products">Error loading TikTok finds.</p>';
    }
} 

// --------------------------------- 
