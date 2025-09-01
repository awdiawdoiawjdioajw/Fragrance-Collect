import http from 'http';
import { URL } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Security configuration
const SECURITY_CONFIG = {
  MAX_REQUEST_SIZE: 1024 * 1024, // 1MB
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100, // 100 requests per window
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'],
  ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false',
  ENABLE_CORS: process.env.ENABLE_CORS !== 'false',
  LOG_SENSITIVE_DATA: process.env.NODE_ENV === 'development'
};

// Configuration with fallbacks
const config = {
  CJ_DEV_KEY: process.env.CJ_DEV_KEY,
  CJ_PERSONAL_ACCESS_TOKEN: process.env.CJ_PERSONAL_ACCESS_TOKEN, // For GraphQL
  CJ_COMPANY_ID: process.env.CJ_COMPANY_ID, // Your publisher/company ID
  CJ_WEBSITE_ID: process.env.CJ_WEBSITE_ID,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  CJ_API_BASE: 'https://product-search.api.cj.com/v2',
  CJ_GQL_API_BASE: 'https://ads.api.cj.com/query', // GraphQL endpoint
  DEFAULT_SEARCH: 'perfume fragrance cologne',
  DEFAULT_LIMIT: 50,
  DEFAULT_PAGE: 1
};

// Currency conversion rates (simplified - in production, use a real API)
const CURRENCY_RATES = {
  USD: 1,
  EUR: 0.85,
  GBP: 0.73,
  CAD: 1.25,
  AUD: 1.35,
  JPY: 110,
  CNY: 6.45
};

// Convert price to USD for comparison
function convertToUSD(price, currency) {
  if (!price || !currency || !CURRENCY_RATES[currency]) {
    return price || 0;
  }
  return price / CURRENCY_RATES[currency];
}

// Convert price from USD to target currency
function convertFromUSD(priceUSD, targetCurrency) {
  if (!priceUSD || !targetCurrency || !CURRENCY_RATES[targetCurrency]) {
    return priceUSD || 0;
  }
  return priceUSD * CURRENCY_RATES[targetCurrency];
}

// Rate limiting storage
const rateLimitStore = new Map();

// Input validation and sanitization
class InputValidator {
  static sanitizeString(input, maxLength = 100) {
    if (typeof input !== 'string') return '';
    
    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // HTML entity encoding to prevent XSS
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    // Limit length
    return sanitized.substring(0, maxLength).trim();
  }

  static validateSearchQuery(query) {
    if (!query || typeof query !== 'string') return '';
    
    const sanitized = this.sanitizeString(query, 200);
    
    // Only allow alphanumeric, spaces, and common punctuation
    const validQuery = sanitized.replace(/[^a-zA-Z0-9\s\-.,&()]/g, '');
    
    return validQuery.trim();
  }

  static validateLimit(limit) {
    const num = parseInt(limit);
    return isNaN(num) || num < 1 || num > 100 ? 50 : num;
  }

  static validatePage(page) {
    const num = parseInt(page);
    return isNaN(num) || num < 1 ? 1 : num;
  }

  static validateScope(scope) {
    const validScopes = ['joined', 'all'];
    return validScopes.includes(scope) ? scope : 'joined';
  }

  static validateOrigin(origin) {
    if (!SECURITY_CONFIG.ENABLE_CORS) return false;
    if (SECURITY_CONFIG.ALLOWED_ORIGINS.includes('*')) return true;
    return SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin);
  }
}

// Rate limiting middleware
function checkRateLimit(ip) {
  if (!SECURITY_CONFIG.ENABLE_RATE_LIMITING) return true;
  
  const now = Date.now();
  const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW;
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }
  
  const requests = rateLimitStore.get(ip);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  rateLimitStore.set(ip, validRequests);
  
  if (validRequests.length >= SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  validRequests.push(now);
  return true;
}

// Security headers
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https://product-search.api.cj.com;");
  
  // Remove server information
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');
}

// CORS headers with origin validation
function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  
  if (InputValidator.validateOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (SECURITY_CONFIG.ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

// Request size validation
function validateRequestSize(req) {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  return contentLength <= SECURITY_CONFIG.MAX_REQUEST_SIZE;
}

// Error response handler
function sendErrorResponse(res, statusCode, error, details = null) {
  const errorResponse = {
    error: error,
    timestamp: new Date().toISOString(),
    requestId: Math.random().toString(36).substr(2, 9)
  };
  
  if (details && SECURITY_CONFIG.LOG_SENSITIVE_DATA) {
    errorResponse.details = details;
  }
  
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(errorResponse, null, 2));
}

// Validate required configuration
function validateConfig() {
  const missing = [];
  if (!config.CJ_DEV_KEY) missing.push('CJ_DEV_KEY');
  if (!config.CJ_WEBSITE_ID) missing.push('CJ_WEBSITE_ID');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file or environment configuration');
    return false;
  }
  
  console.log('✅ Configuration validated successfully');
  return true;
}

// Enhanced error handling for CJ API responses
function handleCJError(response, responseText) {
  const status = response.status;
  let errorMessage = `CJ API error (${status})`;
  
  try {
    const errorData = JSON.parse(responseText);
    if (errorData.error) {
      errorMessage += `: ${errorData.error}`;
    }
    if (errorData.message) {
      errorMessage += ` - ${errorData.message}`;
    }
  } catch (e) {
    // If we can't parse the error, use the raw text (sanitized)
    if (responseText && responseText.length < 200) {
      errorMessage += `: ${InputValidator.sanitizeString(responseText, 100)}`;
    }
  }
  
  return errorMessage;
}

// New function to fetch product feeds using GraphQL
async function getProductFeeds() {
  if (!config.CJ_PERSONAL_ACCESS_TOKEN || !config.CJ_COMPANY_ID) {
    console.warn('⚠️ Missing CJ_PERSONAL_ACCESS_TOKEN or CJ_COMPANY_ID for GraphQL API. Skipping feed fetch.');
    return [];
  }

  const query = `
    query productFeeds($companyId: Int!) {
      productFeeds(companyId: $companyId) {
        totalCount
        count
        resultList {
          adId
          feedName
          advertiserId
          productCount
          lastUpdated
          advertiserName
        }
      }
    }
  `;

  const variables = {
    companyId: parseInt(config.CJ_COMPANY_ID)
  };

  try {
    const response = await fetch(config.CJ_GQL_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.CJ_PERSONAL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CJ GraphQL API error (${response.status}): ${errorText}`);
    }

    const jsonResponse = await response.json();
    if (jsonResponse.errors) {
        throw new Error(`CJ GraphQL API error: ${JSON.stringify(jsonResponse.errors)}`);
    }

    return jsonResponse.data.productFeeds.resultList || [];
  } catch (error) {
    console.error('❌ CJ GraphQL fetch failed:', error.message);
    throw error;
  }
}

// Improved product data mapping from CJ API with XSS protection
function mapCJProduct(cjProduct) {
  return {
    id: InputValidator.sanitizeString(cjProduct.sku || cjProduct.ad_id || cjProduct.productId || `cj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 100),
    name: InputValidator.sanitizeString(cjProduct.name || 'Unnamed Product', 200),
    brand: InputValidator.sanitizeString(cjProduct.manufacturer || cjProduct.advertiserName || 'Unknown Brand', 100),
    price: Number(cjProduct.price) || 0,
    image: InputValidator.sanitizeString(cjProduct.imageUrl || '', 500),
    description: InputValidator.sanitizeString(cjProduct.description || '', 1000),
    cjLink: InputValidator.sanitizeString(cjProduct.buyUrl || '', 500),
    advertiser: InputValidator.sanitizeString(cjProduct.advertiserName || 'Unknown', 100),
    rating: Number(cjProduct.rating) || 0,
    shippingCost: normalizeShipping(cjProduct.shippingCost, cjProduct.shipping, cjProduct.buyUrl),
    category: InputValidator.sanitizeString(cjProduct.category || 'Fragrance', 100),
    availability: InputValidator.sanitizeString(cjProduct.availability || 'In Stock', 50),
    currency: InputValidator.sanitizeString(cjProduct.currency || 'USD', 10)
  };
}

// Enhanced shipping cost normalization
function normalizeShipping(cost, shippingField, url) {
  // Handle explicit cost values
  if (typeof cost === 'number' && cost >= 0) return cost;
  if (typeof cost === 'string') {
    const cleanCost = cost.trim().toLowerCase();
    if (cleanCost === 'free' || cleanCost === '0' || cleanCost === '$0') return 0;
    
    // Try to extract numeric value
    const match = cleanCost.match(/\$?([0-9]+(\.[0-9]{1,2})?)/);
    if (match) return parseFloat(match[1]);
  }
  
  // Handle shipping field
  if (shippingField && typeof shippingField === 'string') {
    const cleanShipping = shippingField.trim().toLowerCase();
    if (cleanShipping.includes('free') || cleanShipping.includes('0')) return 0;
    
    const match = cleanShipping.match(/\$?([0-9]+(\.[0-9]{1,2})?)/);
    if (match) return parseFloat(match[1]);
  }
  
  // Unknown shipping cost
  return null;
}

// Enhanced CJ API product search with input validation
async function searchCJProducts(searchParams) {
  const {
    search = config.DEFAULT_SEARCH,
    perPage = config.DEFAULT_LIMIT,
    page = config.DEFAULT_PAGE,
    scope = 'joined',
    advertiserIds = '', // New parameter
    shipping = '', // Shipping filter
    currency = '', // Currency filter
    lowPrice = null, // Price range filter
    highPrice = null // Price range filter
  } = searchParams;

  // Validate and sanitize inputs
  const validatedSearch = InputValidator.validateSearchQuery(search);
  const validatedLimit = InputValidator.validateLimit(perPage);
  const validatedPage = InputValidator.validatePage(page);
  const validatedScope = InputValidator.validateScope(scope);

  const queryParams = new URLSearchParams({
    'website-id': config.CJ_WEBSITE_ID,
    'advertiser-ids': advertiserIds || validatedScope, // Use advertiserIds if provided
    keywords: validatedSearch,
    'records-per-page': validatedLimit.toString(),
    'page-number': validatedPage.toString(),
    'sort-by': 'popularity', // Sort by popularity instead of price
    format: 'json'
  });

  const apiUrl = `${config.CJ_API_BASE}/product-search?${queryParams.toString()}`;
  
  console.log(`🔍 Searching CJ API: ${validatedSearch} (page ${validatedPage}, limit ${validatedLimit})`);
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': config.CJ_DEV_KEY,
        'Accept': 'application/json',
        'User-Agent': 'FragranceCollect/1.0'
      },
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      const responseText = await response.text();
      const errorMessage = handleCJError(response, responseText);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data || !Array.isArray(data.products)) {
      console.warn('⚠️ CJ API returned unexpected data structure');
      return { products: [], total: 0, page: validatedPage };
    }

    const products = data.products.map(mapCJProduct);
    const total = data.totalResults || data.products.length;
    
    // Filter out ultra-cheap items that are cluttering results
    const filteredProducts = products.filter(product => {
      const price = product.price || 0;
      // Only show items that cost more than $10 to avoid cheap accessories
      return price >= 10;
    });
    
    console.log(`✅ CJ API returned ${filteredProducts.length} products (filtered out ${products.length - filteredProducts.length} items under $10)`);
    
    return {
      products: filteredProducts,
      total: filteredProducts.length,
      page: validatedPage,
      hasMore: filteredProducts.length === validatedLimit
    };
    
  } catch (error) {
    console.error('❌ CJ API search failed:', error.message);
    throw error;
  }
}

// Health check with CJ API connectivity test
async function healthCheck() {
  const basicHealth = { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: config.NODE_ENV
  };
  
  if (!config.CJ_DEV_KEY || !config.CJ_WEBSITE_ID) {
    return {
      ...basicHealth,
      cj: { status: 'error', message: 'Missing CJ credentials' }
    };
  }
  
  try {
    // Test CJ API connectivity with a minimal search
    const testResult = await searchCJProducts({ search: 'test', perPage: 1, page: 1 });
    return {
      ...basicHealth,
      cj: { 
        status: 'ok', 
        message: 'CJ API connected successfully',
        productsReturned: testResult.products.length
      }
    };
  } catch (error) {
    return {
      ...basicHealth,
      cj: { 
        status: 'error', 
        message: InputValidator.sanitizeString(error.message, 200)
      }
    };
  }
}

// Create HTTP server with security middleware
const server = http.createServer(async (req, res) => {
  try {
    // Set security headers
    setSecurityHeaders(res);
    
    // Get client IP for rate limiting
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    
    // Check rate limiting
    if (!checkRateLimit(clientIP)) {
      return sendErrorResponse(res, 429, 'Too Many Requests', 'Rate limit exceeded');
    }
    
    // Validate request size
    if (!validateRequestSize(req)) {
      return sendErrorResponse(res, 413, 'Request Entity Too Large', 'Request exceeds maximum size');
    }
    
    // Set CORS headers
    setCORSHeaders(req, res);
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // Parse and validate URL
    const url = new URL(req.url, `http://localhost:${config.PORT}`);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      const health = await healthCheck();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(health, null, 2));
    }

    // New endpoint to get product feeds
    if (url.pathname === '/feeds') {
      try {
        const feeds = await getProductFeeds();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(feeds, null, 2));
      } catch (error) {
        return sendErrorResponse(res, 500, 'Failed to fetch product feeds', error.message);
      }
    }

    // Products search endpoint
    if (url.pathname === '/products') {
      // Validate and sanitize query parameters
              const searchParams = {
          search: InputValidator.validateSearchQuery(url.searchParams.get('q') || config.DEFAULT_SEARCH),
          perPage: InputValidator.validateLimit(url.searchParams.get('limit') || config.DEFAULT_LIMIT),
          page: InputValidator.validatePage(url.searchParams.get('page') || config.DEFAULT_PAGE),
          scope: InputValidator.validateScope(url.searchParams.get('scope') || 'joined'),
          advertiserIds: InputValidator.sanitizeString(url.searchParams.get('advertiserIds') || '', 500),
          shipping: InputValidator.sanitizeString(url.searchParams.get('shipping') || '', 50),
          currency: InputValidator.sanitizeString(url.searchParams.get('currency') || '', 10),
          lowPrice: url.searchParams.get('lowPrice') ? parseFloat(url.searchParams.get('lowPrice')) : null,
          highPrice: url.searchParams.get('highPrice') ? parseFloat(url.searchParams.get('highPrice')) : null
        };

      try {
        const result = await searchCJProducts(searchParams);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result, null, 2));
      } catch (error) {
        return sendErrorResponse(res, 500, 'Product search failed', error.message);
      }
    }

    // Configuration endpoint (for debugging - only in development)
    if (url.pathname === '/config' && config.NODE_ENV === 'development') {
      const safeConfig = {
        NODE_ENV: config.NODE_ENV,
        PORT: config.PORT,
        CJ_API_BASE: config.CJ_API_BASE,
        CJ_DEV_KEY: config.CJ_DEV_KEY ? `${config.CJ_DEV_KEY.substring(0, 8)}...` : 'NOT_SET',
        CJ_WEBSITE_ID: config.CJ_WEBSITE_ID ? `${config.CJ_WEBSITE_ID.substring(0, 8)}...` : 'NOT_SET',
        SECURITY: {
          RATE_LIMITING: SECURITY_CONFIG.ENABLE_RATE_LIMITING,
          CORS: SECURITY_CONFIG.ENABLE_CORS,
          MAX_REQUEST_SIZE: SECURITY_CONFIG.MAX_REQUEST_SIZE
        }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(safeConfig, null, 2));
    }

    // 404 for unknown endpoints
    return sendErrorResponse(res, 404, 'Not found', `Available endpoints: /health, /products, /config`);
    
  } catch (error) {
    console.error('❌ Server error:', error);
    return sendErrorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Start server
server.listen(config.PORT, () => {
  console.log(`🚀 Fragrance Collect API server starting...`);
  console.log(`📍 Port: ${config.PORT}`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);
  console.log(`🔒 Security: Rate limiting ${SECURITY_CONFIG.ENABLE_RATE_LIMITING ? 'enabled' : 'disabled'}, CORS ${SECURITY_CONFIG.ENABLE_CORS ? 'enabled' : 'disabled'}`);
  
  if (validateConfig()) {
    console.log(`✅ Server ready on port ${config.PORT}`);
    console.log(`🔗 Health check: http://localhost:${config.PORT}/health`);
    console.log(`🔗 Products: http://localhost:${config.PORT}/products`);
  } else {
    console.error(`❌ Server started but configuration is invalid`);
    console.error(`   Some endpoints may not work properly`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW;
  
  for (const [ip, requests] of rateLimitStore.entries()) {
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    if (validRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, validRequests);
    }
  }
}, 60000); // Clean up every minute


