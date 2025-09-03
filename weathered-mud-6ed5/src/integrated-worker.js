// A map to cache Google's public keys.
// Keys are key IDs, values are the imported CryptoKey objects.
const keyCache = new Map();
let lastKeyFetchTime = 0;
const KEY_CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

// Revenue optimization constants
const REVENUE_CONFIG = {
  TIKTOK_PARTNER_ID: '7563286',
  CJ_WEIGHT: 0.7, // CJ products get 70% weight
  TIKTOK_WEIGHT: 0.3, // TikTok products get 30% weight
  MIN_COMMISSION_RATE: 0.05, // 5% minimum commission
  OPTIMAL_PRICE_RANGE: { min: 50, max: 300 },
  TRENDING_CACHE_DURATION: 300, // 5 minutes for trending
  HOT_SEARCH_CACHE_DURATION: 600, // 10 minutes for hot searches
  BRAND_CACHE_DURATION: 7200, // 2 hours for brand searches
  GENERIC_CACHE_DURATION: 1800, // 30 minutes for generic terms
  SEASONAL_CACHE_DURATION: 3600 // 1 hour for seasonal searches
};

// Commission rates by brand category (example - adjust based on your CJ data)
const COMMISSION_RATES = {
  'luxury': { rate: 0.12, weight: 1.0 },
  'designer': { rate: 0.10, weight: 0.9 },
  'niche': { rate: 0.08, weight: 0.8 },
  'celebrity': { rate: 0.09, weight: 0.85 },
  'seasonal': { rate: 0.07, weight: 0.75 },
  'default': { rate: 0.06, weight: 0.7 }
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    console.log(`[Request] Method: ${request.method}, Path: ${path}`);

    // --- AUTHENTICATION ENDPOINTS ---
    if (path === '/api/signup/email' && request.method === 'POST') {
      return handleEmailSignup(request, env);
    }
    if (path === '/api/login/email' && request.method === 'POST') {
      return handleEmailLogin(request, env);
    }
    if (path === '/api/login/google' && request.method === 'POST') {
        return handleGoogleLogin(request, env);
    }
    if (path === '/api/status' && request.method === 'GET') {
      return handleGetStatus(request, env);
    }
    if (path === '/api/token' && request.method === 'GET') {
        return handleGetToken(request, env);
    }
    if (path === '/api/logout' && request.method === 'POST') {
        return handleLogout(request, env);
    }
    
    // --- API ENDPOINTS ---
    if (path === '/api/products') {
        return handleProductsRequest(request, url, env);
    }
    if (path === '/api/feeds') {
        return handleFeedsRequest(env);
    }
    if (path === '/api/trending') {
        return handleTrendingRequest(env);
    }
    if (path === '/api/analytics') {
        return handleAnalyticsRequest(request, env);
    }
    if (path === '/api/health') {
          return handleHealthRequest(env);
    }

    // --- NEW ACCOUNT FEATURE ENDPOINTS ---
    if (path.startsWith('/api/user/')) {
        if (path === '/api/user/preferences' && request.method === 'GET') {
            return handleGetPreferences(request, env);
        }
        if (path === '/api/user/preferences' && request.method === 'POST') {
            return handleUpdatePreferences(request, env);
        }
        if (path === '/api/user/favorites' && request.method === 'GET') {
            return handleGetFavorites(request, env);
        }
        if (path === '/api/user/favorites' && request.method === 'POST') {
            return handleAddFavorite(request, env);
        }
        if (path.startsWith('/api/user/favorites/') && request.method === 'DELETE') {
            return handleDeleteFavorite(request, env);
        }
    }

    const headers = getSecurityHeaders(request.headers.get('Origin'));
    return new Response('Not Found', { status: 404, headers });
  },
};


// --- SECURITY & UTILITY FUNCTIONS ---

// In-memory request tracker for rate limiting.
const requestTracker = new Map();

/**
 * Checks if an IP address has exceeded the rate limit for a specific endpoint.
 * @param {string} ip - The client IP address.
 * @param {string} endpoint - The endpoint name (e.g., 'login').
 * @param {number} limit - The max number of requests allowed.
 * @param {number} windowMs - The time window in milliseconds.
 * @returns {boolean} - True if the request is rate-limited, false otherwise.
 */
function isRateLimited(ip, endpoint, limit, windowMs) {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    
    // Clean up old records and get recent ones
    const records = (requestTracker.get(key) || []).filter(timestamp => (now - timestamp) < windowMs);

    if (records.length >= limit) {
        return true; // Rate limit exceeded
    }

    records.push(now);
    requestTracker.set(key, records);
    return false;
}

/**
 * Validates the format of an email address.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    if (!email) return false;
    // A more robust regex for email validation
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Validates password complexity requirements.
 * @param {string} password
 * @returns {{isValid: boolean, errors: string[]}}
 */
function validatePasswordComplexity(password) {
    const errors = [];
    const minLength = 8;
    
    if (!password || password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long.`);
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character.');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}


/**
 * Hashes a password using PBKDF2 with a random salt.
 * @param {string} password
 * @returns {Promise<string>} The salt and hash, separated by a colon.
 */
async function hashPasswordPBKDF2(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-512',
        },
        keyMaterial,
        512
    );
    const hashArray = Array.from(new Uint8Array(derivedBits));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${saltHex}:${hashHex}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash.
 * @param {string} password - The plaintext password to verify.
 * @param {string} storedHash - The stored hash, including the salt.
 * @returns {Promise<boolean>} True if the password is correct.
 */
async function verifyPasswordPBKDF2(password, storedHash) {
    const [saltHex, originalHashHex] = storedHash.split(':');
    if (!saltHex || !originalHashHex) return false;

    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-512',
        },
        keyMaterial,
        512
    );
    const hashArray = Array.from(new Uint8Array(derivedBits));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return compareHashes(hashHex, originalHashHex);
}

function compareHashes(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

const ALLOWED_ORIGINS = [ 'https://fragrancecollect.com', 'https://www.fragrancecollect.com', 'https://fragrance-collect.pages.dev', 'https://heart.github.io', 'http://localhost:', 'http://127.0.0.1:', 'file://' ];
function isOriginAllowed(origin) {
    if (!origin || origin === 'null') return true;
    return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}
function validateSiteOrigin(request) {
    return isOriginAllowed(request.headers.get('Origin'));
}
function getSecurityHeaders(origin) {
    const headers = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
    };
    if (isOriginAllowed(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

function handleOptions(request) {
  const origin = request.headers.get('Origin');
  return new Response(null, { headers: getSecurityHeaders(origin) });
}

async function createSession(request, env, userId) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const sessionFingerprint = await sha512(`${clientIP}:${userAgent}`);
    await cleanupUserSessions(env, userId);
    await env.DB.prepare(`INSERT INTO user_sessions (id, user_id, token, expires_at, client_ip, user_agent, fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), userId, token, expiresAt.toISOString(), clientIP, userAgent, sessionFingerprint).run();
    return token;
}

function createCookie(token, maxAge, origin) {
    let cookieString = `session_token=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=None; Secure`;
    return cookieString;
}

function getTokenFromRequest(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.substring(7);
    const cookieHeader = request.headers.get('Cookie') || '';
    return cookieHeader.match(/session_token=([^;]+)/)?.[1] || null;
}

async function getValidSession(env, token) {
    const session = await env.DB.prepare(`SELECT s.*, u.email, u.name, u.picture FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?`).bind(token).first();
    if (!session || new Date(session.expires_at) < new Date()) return null;
    return session;
}

async function validateSessionSecurity(session, request) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const currentFingerprint = await sha512(`${clientIP}:${userAgent}`);
    return session.fingerprint === currentFingerprint;
}

async function cleanupUserSessions(env, userId) {
    await env.DB.prepare(`DELETE FROM user_sessions WHERE user_id = ? AND expires_at < CURRENT_TIMESTAMP`).bind(userId).run();
}

async function sha512(str) {
  const buffer = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(str));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data, status = 200, headers = {}) {
  const finalHeaders = { ...headers, 'Content-Type': 'application/json' };
  return new Response(JSON.stringify(data), { status, headers: finalHeaders });
}

// --- AUTHENTICATION FUNCTIONS ---

async function handleEmailSignup(request, env) {
    const origin = request.headers.get('Origin');
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown-ip';

    if (isRateLimited(clientIP, 'signup', 10, 60 * 60 * 1000)) { // 10 signups per hour
        return jsonResponse({ error: 'Too many signup attempts. Please try again later.' }, 429, getSecurityHeaders(origin));
    }
    
    if (!validateSiteOrigin(request)) {
        return jsonResponse({ error: 'Unauthorized origin' }, 403, getSecurityHeaders(origin));
    }

    const headers = getSecurityHeaders(origin);
    try {
        const { name, email, password } = await request.json();
        if (!name || !email || !password) return jsonResponse({ error: 'Name, email, and password are required.' }, 400, headers);

        if (!isValidEmail(email)) {
            return jsonResponse({ error: 'Invalid email format.' }, 400, headers);
        }

        const passwordValidation = validatePasswordComplexity(password);
        if (!passwordValidation.isValid) {
            return jsonResponse({ error: 'Password does not meet complexity requirements.', details: passwordValidation.errors }, 400, headers);
        }

        const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existingUser) return jsonResponse({ error: 'A user with this email already exists.' }, 409, headers);
        
        const passwordHash = await hashPasswordPBKDF2(password);
        // 4. Create user in the database
        const userId = crypto.randomUUID();
        await env.DB.prepare(`INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`).bind(userId, name, email, passwordHash).run();

        // 5. Create a session for the new user
        const token = await createSession(request, env, userId);
        headers['Set-Cookie'] = createCookie(token, 24 * 60 * 60 * 1000, request.headers.get('Origin'));

        return jsonResponse({ success: true, user: { id: userId, name, email }, token }, 201, headers);
    } catch (error) {
        console.error('Error during email signup:', error);
        return jsonResponse({ error: 'Signup failed.', details: error.message }, 500, headers);
    }
}

async function handleEmailLogin(request, env) {
    const origin = request.headers.get('Origin');
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown-ip';

    if (isRateLimited(clientIP, 'login', 10, 15 * 60 * 1000)) { // 10 login attempts per 15 mins
        return jsonResponse({ error: 'Too many login attempts. Please try again later.' }, 429, getSecurityHeaders(origin));
    }
    
    if (!validateSiteOrigin(request)) {
        return jsonResponse({ error: 'Unauthorized origin' }, 403, getSecurityHeaders(origin));
    }
    const headers = getSecurityHeaders(origin);
    try {
        const { email, password } = await request.json();
        if (!email || !password) return jsonResponse({ error: 'Email and password are required.' }, 400, headers);

        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (!user || !user.password_hash) return jsonResponse({ error: 'Invalid email or password.' }, 401, headers);
        
        let isValidPassword = false;
        // Check if the hash is in the new PBKDF2 format
        if (user.password_hash.includes(':')) {
            isValidPassword = await verifyPasswordPBKDF2(password, user.password_hash);
        } else {
            // Fallback for old SHA-512 hashes
            const passwordHash = await sha512(password);
            isValidPassword = compareHashes(passwordHash, user.password_hash);

            // If valid, migrate the hash to the new format
            if (isValidPassword) {
                const newHash = await hashPasswordPBKDF2(password);
                await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, user.id).run();
            }
        }

        if (!isValidPassword) {
            return jsonResponse({ error: 'Invalid email or password.' }, 401, headers);
        }

        const token = await createSession(request, env, user.id);
        headers['Set-Cookie'] = createCookie(token, 24 * 60 * 60 * 1000, request.headers.get('Origin'));

        return jsonResponse({ success: true, user: { id: user.id, name: user.name, email: user.email, picture: user.picture }, token }, 200, headers);
    } catch (error) {
        console.error('Error during email login:', error.message);
        return jsonResponse({ error: 'Login failed.', details: error.message }, 500, headers);
    }
}

async function handleGetStatus(request, env) {
    const headers = getSecurityHeaders(request.headers.get('Origin'));
    try {
        const token = getTokenFromRequest(request);
        if (!token) return jsonResponse({ error: 'Not authenticated' }, 401, headers);

        const session = await getValidSession(env, token);
        if (!session) {
            headers['Set-Cookie'] = createCookie('', -1); // Expire cookie
            return jsonResponse({ error: 'Invalid or expired session' }, 401, headers);
        }

        if (!validateSessionSecurity(session, request)) {
            await env.DB.prepare(`DELETE FROM user_sessions WHERE token = ?`).bind(token).run();
            headers['Set-Cookie'] = createCookie('', -1);
            return jsonResponse({ error: 'Session security validation failed' }, 401, headers);
        }

        await env.DB.prepare(`UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE token = ?`).bind(token).run();

        return jsonResponse({ success: true, user: { id: session.user_id, email: session.email, name: session.name, picture: session.picture } }, 200, headers);
    } catch (error) {
        console.error('Error getting status:', error);
        return jsonResponse({ error: 'Failed to get user status' }, 500, headers);
    }
}

async function handleGetToken(request, env) {
    const headers = getSecurityHeaders(request.headers.get('Origin'));
    try {
        const token = getTokenFromRequest(request);
        if (!token) return jsonResponse({ error: 'Not authenticated' }, 401, headers);
        const session = await getValidSession(env, token);
        if (!session) return jsonResponse({ error: 'Invalid or expired session' }, 401, headers);
        return jsonResponse({ success: true, token }, 200, headers);
    } catch (error) {
        console.error('Error getting token:', error);
        return jsonResponse({ error: 'Failed to get token' }, 500, headers);
    }
}

async function handleLogout(request, env) {
    const headers = getSecurityHeaders(request.headers.get('Origin'));
    try {
        const token = getTokenFromRequest(request);
        if (token) {
            await env.DB.prepare(`DELETE FROM user_sessions WHERE token = ?`).bind(token).run();
        }
        headers['Set-Cookie'] = createCookie('', -1); // Expire cookie
        return jsonResponse({ success: true, message: 'Logged out' }, 200, headers);
    } catch (error) {
        console.error('Error during logout:', error);
        return jsonResponse({ error: 'Logout failed' }, 500, headers);
    }
}

async function handleGoogleLogin(request, env) {
    const origin = request.headers.get('Origin');
    const headers = getSecurityHeaders(origin);

    try {
        const { token } = await request.json();
        if (!token) {
            return jsonResponse({ error: 'Google token is required.' }, 400, headers);
        }

        // 1. Verify the token
        const payload = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID);
        if (!payload) {
            return jsonResponse({ error: 'Invalid Google token.' }, 401, headers);
        }

        // 2. Check if user exists, or create a new one
        const { email, name, picture } = payload;
        let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

        let userId;
        if (user) {
            userId = user.id;
            // Optionally, update user's name and picture from Google profile
            if (user.name !== name || user.picture !== picture) {
                await env.DB.prepare('UPDATE users SET name = ?, picture = ? WHERE id = ?')
                            .bind(name, picture, userId)
                            .run();
            }
        } else {
            // Create new user
            userId = crypto.randomUUID();
            await env.DB.prepare('INSERT INTO users (id, email, name, picture, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
                        .bind(userId, email, name, picture)
                        .run();
            user = { id: userId, email, name, picture };
        }
        
        // 3. Create a session
        const sessionToken = await createSession(request, env, userId);
        headers['Set-Cookie'] = createCookie(sessionToken, 24 * 60 * 60 * 1000, origin);

        return jsonResponse({
            success: true,
            user: { id: userId, name, email, picture },
            token: sessionToken
        }, 200, headers);

    } catch (error) {
        console.error('Error during Google login:', error);
        return jsonResponse({ error: 'Google login failed.', details: error.message }, 500, headers);
    }
}


// --- API FUNCTIONS ---

async function handleProductsRequest(request, url, env) {
  const { searchParams } = new URL(url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const offset = (page - 1) * limit;
  const lowPrice = parseFloat(searchParams.get('lowPrice')) || null;
  const highPrice = parseFloat(searchParams.get('highPrice')) || null;
  const partnerId = searchParams.get('partnerId') || null;
  const includeTikTok = searchParams.get('includeTikTok') !== 'false';
  const sortBy = searchParams.get('sortBy') || 'revenue';
  const brandFilter = searchParams.get('brand') || null;
  const exactMatch = searchParams.get('exactMatch') === 'true';

  console.log('💸 Revenue-optimized search initiated:', { query, limit, page, sortBy, exactMatch });
  console.log('🔍 Exact match mode:', exactMatch ? 'ENABLED' : 'DISABLED');

  try {
    const cjProducts = await searchCJStore(query, 250, 0, lowPrice, highPrice, partnerId, env, exactMatch);
    console.log(`✅ CJ Store: Found ${cjProducts.length} products`);
    
    let tiktokProducts = [];
    if (includeTikTok && !partnerId) {
      tiktokProducts = await searchTikTokStore(query, 100, 0, lowPrice, highPrice, env, exactMatch);
      console.log(`🎵 TikTok Shop: Found ${tiktokProducts.length} products`);
    }

    if (cjProducts.length === 0 && tiktokProducts.length > 0) {
      console.log('🔄 Smart fallback: Using TikTok results as primary');
      tiktokProducts = await searchTikTokStore(query, 200, 0, lowPrice, highPrice, env);
    }

    const allProducts = [...cjProducts, ...tiktokProducts];
    const deduplicatedProducts = deduplicateProducts(allProducts);
    
    let filteredProducts = deduplicatedProducts;
    if (exactMatch && query) {
        console.log('🔍 Applying STRICT exact match filtering for query:', query);
        const queryLower = query.toLowerCase().trim();
        const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
        
        filteredProducts = deduplicatedProducts.filter(product => {
            const title = (product.title || product.name || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            
            const allText = `${title} ${brand} ${description}`;
            
            return queryWords.every(queryWord => allText.includes(queryWord));
        });
        console.log(`🔍 STRICT exact match filtering: ${deduplicatedProducts.length} -> ${filteredProducts.length} products`);
    }
    
    const optimizedProducts = optimizeForRevenue(filteredProducts, query, sortBy, brandFilter, REVENUE_CONFIG, COMMISSION_RATES);
    const products = optimizedProducts.map(p => formatProductForRevenue(p, query, REVENUE_CONFIG, COMMISSION_RATES)).filter(Boolean);

    const total = products.length;
    const paginatedProducts = products.slice(offset, offset + limit);
    const revenueMetrics = calculateRevenueMetrics(paginatedProducts, cjProducts.length, tiktokProducts.length);

    const responseData = {
      products: paginatedProducts,
      total,
      page,
      limit,
      hasMore: total > (offset + limit),
      searchQuery: query,
      filters: { lowPrice, highPrice, partnerId, includeTikTok, sortBy, brandFilter, exactMatch },
      revenue: revenueMetrics,
      sources: {
        cj: cjProducts.length,
        tiktok: tiktokProducts.length,
        total: filteredProducts.length
      },
      optimization: {
        strategy: 'revenue-maximization',
        commissionWeighting: 'CJ-70%-TikTok-30%',
        smartFallback: cjProducts.length === 0 && tiktokProducts.length > 0,
        exactMatchApplied: exactMatch && query
      }
    };

    return jsonResponse(responseData, 200, getSecurityHeaders(request.headers.get('Origin')));

  } catch (error) {
    console.error('Error fetching products:', error);
    return jsonResponse({ error: 'Failed to fetch products from stores', details: error.message }, 500, getSecurityHeaders(request.headers.get('Origin')));
  }
}

async function searchCJStore(query, limit, offset, lowPrice, highPrice, partnerId, env, exactMatch = false) {
  const gqlQuery = buildShoppingProductsQuery(!!partnerId);
  const keywords = query ? (exactMatch ? [query] : query.split(/\s+/).filter(k => k.length > 0)) : ['fragrance'];

  const gqlVariables = {
    companyId: env.CJ_COMPANY_ID,
    keywords: keywords,
    limit: Math.min(limit, 500),
    offset,
    websiteId: env.CJ_WEBSITE_ID,
    lowPrice,
    highPrice,
    partnerIds: partnerId ? [partnerId] : null
  };
  
  const gqlData = await fetchCJProducts(gqlQuery, gqlVariables, env);
  return gqlData.data?.shoppingProducts?.resultList || [];
}

async function searchTikTokStore(query, limit, offset, lowPrice, highPrice, env, exactMatch = false) {
  try {
    const gqlQuery = buildShoppingProductsQuery(true);
    const keywords = query ? (exactMatch ? [query] : query.split(/\s+/).filter(k => k.length > 0)) : ['viral perfume', 'trending fragrance'];

    const gqlVariables = {
      companyId: env.CJ_COMPANY_ID,
      keywords: keywords,
      limit: Math.min(limit, 200),
      offset,
      websiteId: env.CJ_WEBSITE_ID,
      lowPrice,
      highPrice,
      partnerIds: [REVENUE_CONFIG.TIKTOK_PARTNER_ID]
    };
    
    const gqlData = await fetchCJProducts(gqlQuery, gqlVariables, env);
    return gqlData.data?.shoppingProducts?.resultList || [];
  } catch (error) {
    console.error('TikTok Store search failed:', error);
    return [];
  }
}

async function fetchCJProducts(gqlQuery, variables, env) {
  if (!env.CJ_DEV_KEY) {
      throw new Error("CJ_DEV_KEY is not configured in environment secrets.");
  }
  const gqlRes = await fetch('https://ads.api.cj.com/query', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.CJ_DEV_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gqlQuery, variables })
  });

  if (!gqlRes.ok) {
    const errorText = await gqlRes.text();
    console.error('CJ API HTTP Error:', gqlRes.status, errorText);
    throw new Error(`CJ API Error ${gqlRes.status}: ${errorText}`);
  }

  const gqlData = await gqlRes.json();
  if (gqlData.errors) {
    console.error('CJ GraphQL Errors:', JSON.stringify(gqlData.errors, null, 2));
    throw new Error(`CJ GraphQL Error: ${JSON.stringify(gqlData.errors)}`);
  }
  return gqlData;
}

function buildShoppingProductsQuery(includePartnerIds) {
  const varDecl = includePartnerIds ? ", $partnerIds: [ID!]" : "";
  const argUse = includePartnerIds ? ", partnerIds: $partnerIds" : "";
  return `
    query shoppingProducts($companyId: ID!, $keywords: [String!], $limit: Int!, $offset: Int!, $websiteId: ID!, $lowPrice: Float, $highPrice: Float${varDecl}) {
      shoppingProducts(companyId: $companyId, keywords: $keywords, limit: $limit, offset: $offset, lowPrice: $lowPrice, highPrice: $highPrice${argUse}) {
        totalCount
        resultList {
          id
          title
          brand
          price { amount currency }
          imageLink
          advertiserName
          shipping { price { amount currency } }
          linkCode(pid: $websiteId) { clickUrl }
        }
      }
    }
  `;
}

function optimizeForRevenue(products, query, sortBy, brandFilter, REVENUE_CONFIG, COMMISSION_RATES) {
  let filtered = products.filter(p => {
    if (brandFilter && p.brand?.toLowerCase() !== brandFilter.toLowerCase()) return false;
    return true;
  });

  filtered = filtered.map(p => ({
    ...p,
    revenueScore: calculateRevenueScore(p, query, REVENUE_CONFIG, COMMISSION_RATES),
    commissionRate: getCommissionRate(p, COMMISSION_RATES),
    trendingScore: calculateTrendingScore(p)
  }));

  switch (sortBy) {
    case 'revenue':
      return filtered.sort((a, b) => b.revenueScore - a.revenueScore);
    case 'commission':
      return filtered.sort((a, b) => b.commissionRate - a.commissionRate);
    case 'trending':
      return filtered.sort((a, b) => b.trendingScore - a.trendingScore);
    case 'price_low':
      return filtered.sort((a, b) => parseFloat(a.price?.amount || 0) - parseFloat(b.price?.amount || 0));
    case 'price_high':
      return filtered.sort((a, b) => parseFloat(b.price?.amount || 0) - parseFloat(a.price?.amount || 0));
    default: // relevance
      return filtered.sort((a, b) => calculateRelevance(b, query) - calculateRelevance(a, query));
  }
}

function calculateRevenueScore(product, query, REVENUE_CONFIG, COMMISSION_RATES) {
  let score = 0;
  const commissionRate = getCommissionRate(product, COMMISSION_RATES);
  score += commissionRate * 100;

  const price = parseFloat(product.price?.amount || 0);
  if (price >= REVENUE_CONFIG.OPTIMAL_PRICE_RANGE.min && price <= REVENUE_CONFIG.OPTIMAL_PRICE_RANGE.max) {
    score += 50;
  }

  const brandCategory = getBrandCategory(product);
  const categoryWeight = COMMISSION_RATES[brandCategory]?.weight || COMMISSION_RATES.default.weight;
  score *= categoryWeight;

  if (query) {
    const relevance = calculateRelevance(product, query);
    score += relevance * 0.3;
  }

  if (product.advertiserName?.includes('TikTok')) {
    score *= REVENUE_CONFIG.TIKTOK_WEIGHT;
  } else {
    score *= REVENUE_CONFIG.CJ_WEIGHT;
  }
  return score;
}

function getCommissionRate(product, COMMISSION_RATES) {
  if (!product.linkCode?.clickUrl) return 0;
  const brandCategory = getBrandCategory(product);
  return COMMISSION_RATES[brandCategory]?.rate || COMMISSION_RATES.default.rate;
}

function getBrandCategory(product) {
  const brand = product.brand?.toLowerCase() || '';
  const title = product.title?.toLowerCase() || '';
  if (brand.includes('luxury') || title.includes('luxury')) return 'luxury';
  if (brand.includes('designer') || title.includes('designer')) return 'designer';
  if (brand.includes('niche') || title.includes('niche')) return 'niche';
  if (brand.includes('celebrity') || title.includes('celebrity')) return 'celebrity';
  if (title.includes('limited') || title.includes('seasonal')) return 'seasonal';
  return 'default';
}

function calculateTrendingScore(product) {
  let score = 0;
  const title = product.title?.toLowerCase() || '';
  if (title.includes('viral') || title.includes('trending')) score += 30;
  if (title.includes('tiktok') || title.includes('social media')) score += 25;
  if (title.includes('limited edition')) score += 20;
  if (title.includes('new') || title.includes('2024')) score += 15;
  return score;
}

function calculateRelevance(product, query) {
  if (!query) return 0;
  const queryLower = query.toLowerCase();
  const titleLower = product.title?.toLowerCase() || '';
  const brandLower = product.brand?.toLowerCase() || '';
  let score = 0;
  if (titleLower.includes(queryLower)) score += 100;
  if (brandLower.includes(queryLower)) score += 80;
  const queryWords = queryLower.split(/\s+/);
  queryWords.forEach(word => {
    if (titleLower.includes(word)) score += 20;
    if (brandLower.includes(word)) score += 15;
  });
  return score;
}

function formatProductForRevenue(p, query, REVENUE_CONFIG, COMMISSION_RATES) {
  const cjLink = p.linkCode?.clickUrl;
  if (!cjLink || !p.imageLink) return null;

  const price = parseFloat(p.price?.amount || 0);
  const commissionRate = getCommissionRate(p, COMMISSION_RATES);
  return {
    id: p.id,
    name: p.title,
    brand: p.brand || p.advertiserName,
    price: price,
    image: p.imageLink,
    shippingCost: parseFloat(p.shipping?.price?.amount || 0),
    cjLink: cjLink,
    advertiser: p.advertiserName,
    currency: p.price?.currency || 'USD',
    revenue: {
      commissionRate: commissionRate,
      estimatedCommission: price * commissionRate,
      revenueScore: calculateRevenueScore(p, query, REVENUE_CONFIG, COMMISSION_RATES)
    },
    relevance: calculateRelevance(p, query)
  };
}

function calculateRevenueMetrics(products, cjCount, tiktokCount) {
  const totalProducts = products.length;
  if (totalProducts === 0) return { totalProducts: 0 };
  const totalValue = products.reduce((sum, p) => sum + (p.price || 0), 0);
  const avgCommission = products.reduce((sum, p) => sum + (p.revenue?.commissionRate || 0), 0) / totalProducts;
  const estimatedTotalCommission = products.reduce((sum, p) => sum + (p.revenue?.estimatedCommission || 0), 0);
  return {
    totalProducts,
    totalValue: totalValue.toFixed(2),
    avgCommissionRate: (avgCommission * 100).toFixed(2) + '%',
    estimatedTotalCommission: estimatedTotalCommission.toFixed(2),
    sources: { cj: cjCount, tiktok: tiktokCount }
  };
}

function deduplicateProducts(products) {
  const seen = new Map();
  return products.filter(product => {
    const key = `${product.title?.toLowerCase()}-${product.brand?.toLowerCase()}-${product.price?.amount}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

async function handleHealthRequest(env) {
  return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
}

async function handleFeedsRequest(env) {
  const query = `query productFeeds($companyId: ID!) { productFeeds(companyId: $companyId) { resultList { adId feedName advertiserId productCount lastUpdated advertiserName } } }`;
  const gqlData = await fetchCJProducts(query, { companyId: env.CJ_COMPANY_ID }, env);
  return jsonResponse(gqlData.data.productFeeds.resultList || []);
}

async function handleTrendingRequest(env) {
  return jsonResponse({ trending: ['luxury perfume', 'designer fragrance', 'viral perfume', 'limited edition'] });
}

async function handleAnalyticsRequest(request, env) {
  return jsonResponse({ message: 'Analytics endpoint - coming soon' });
}


// --- ACCOUNT FEATURE FUNCTIONS (Preferences & Favorites) ---

async function handleGetPreferences(request, env) {
    const { user, headers, errorResponse } = await getUserFromRequest(request, env);
    if (errorResponse) return errorResponse;

    try {
        const prefs = await env.DB.prepare(`SELECT * FROM user_preferences WHERE user_id = ?`).bind(user.id).first();
        if (!prefs) {
            return jsonResponse({ preferences: {} }, 200, headers);
        }
        return jsonResponse({ preferences: prefs }, 200, headers);
    } catch (error) {
        console.error('Error getting preferences:', error);
        return jsonResponse({ error: 'Failed to get preferences' }, 500, headers);
    }
}

async function handleUpdatePreferences(request, env) {
    const { user, headers, errorResponse } = await getUserFromRequest(request, env);
    if (errorResponse) return errorResponse;

    try {
        const prefs = await request.json();
        await env.DB.prepare(`
            INSERT INTO user_preferences (user_id, scent_categories, intensity, season, occasion, budget_range, sensitivities, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                scent_categories = excluded.scent_categories,
                intensity = excluded.intensity,
                season = excluded.season,
                occasion = excluded.occasion,
                budget_range = excluded.budget_range,
                sensitivities = excluded.sensitivities,
                updated_at = CURRENT_TIMESTAMP
        `).bind(user.id, prefs.scent_categories, prefs.intensity, prefs.season, prefs.occasion, prefs.budget_range, prefs.sensitivities).run();

        return jsonResponse({ success: true, message: 'Preferences updated' }, 200, headers);
    } catch (error) {
        console.error('Error updating preferences:', error);
        return jsonResponse({ error: 'Failed to update preferences' }, 500, headers);
    }
}

async function handleGetFavorites(request, env) {
    const { user, headers, errorResponse } = await getUserFromRequest(request, env);
    if (errorResponse) return errorResponse;

    try {
        const { results } = await env.DB.prepare(`SELECT * FROM user_favorites WHERE user_id = ? ORDER BY added_at DESC`).bind(user.id).all();
        return jsonResponse({ success: true, favorites: results || [] }, 200, headers);
    } catch (error) {
        console.error('Error getting favorites:', error);
        return jsonResponse({ error: 'Failed to get favorites' }, 500, headers);
    }
}

async function handleAddFavorite(request, env) {
    const { user, headers, errorResponse } = await getUserFromRequest(request, env);
    if (errorResponse) return errorResponse;

    try {
        const favorite = await request.json();
        
        // Ensure the required fields are present
        if (!favorite.fragrance_id || !favorite.name) {
            return jsonResponse({ error: 'fragrance_id and name are required' }, 400, headers);
        }

        // Sanitize input by converting undefined to null for optional fields
        const price = favorite.price === undefined ? null : favorite.price;
        const shippingCost = favorite.shippingCost === undefined ? null : favorite.shippingCost;

        await env.DB.prepare(`
            INSERT INTO user_favorites (id, user_id, fragrance_id, name, advertiserName, description, imageUrl, productUrl, price, currency, shippingCost, shipping_availability)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, fragrance_id) DO UPDATE SET
                name = excluded.name,
                advertiserName = excluded.advertiserName,
                description = excluded.description,
                imageUrl = excluded.imageUrl,
                productUrl = excluded.productUrl,
                price = excluded.price,
                currency = excluded.currency,
                shippingCost = excluded.shippingCost,
                shipping_availability = excluded.shipping_availability,
                added_at = CURRENT_TIMESTAMP
        `).bind(
            crypto.randomUUID(),
            user.id,
            favorite.fragrance_id,
            favorite.name,
            favorite.advertiserName || null,
            favorite.description || null,
            favorite.imageUrl || null,
            favorite.productUrl || null,
            price,
            favorite.currency || null,
            shippingCost,
            favorite.shipping_availability || null
        ).run();

        return jsonResponse({ success: true, message: 'Favorite added' }, 201, headers);
    } catch (error) {
        console.error('Error adding favorite:', error);
        return jsonResponse({ error: 'Failed to add favorite', details: error.message }, 500, headers);
    }
}

async function handleDeleteFavorite(request, env) {
    const { user, headers, errorResponse } = await getUserFromRequest(request, env);
    if (errorResponse) return errorResponse;

    try {
        const url = new URL(request.url);
        const fragranceId = url.pathname.split('/').pop();

        if (!fragranceId) {
            return jsonResponse({ error: 'Fragrance ID is required' }, 400, headers);
        }

        const { success, meta } = await env.DB.prepare(`DELETE FROM user_favorites WHERE user_id = ? AND fragrance_id = ?`).bind(user.id, fragranceId).run();

        if (meta.changes === 0) {
            return jsonResponse({ error: 'Favorite not found or not owned by user' }, 404, headers);
        }

        return jsonResponse({ success: true, message: 'Favorite removed' }, 200, headers);
    } catch (error) {
        console.error('Error deleting favorite:', error);
        return jsonResponse({ error: 'Failed to delete favorite' }, 500, headers);
    }
}

async function getUserFromRequest(request, env) {
    const origin = request.headers.get('Origin');
    const headers = getSecurityHeaders(origin);
    const token = getTokenFromRequest(request);

    if (!token) {
        return { errorResponse: jsonResponse({ error: 'Not authenticated' }, 401, headers) };
    }

    const session = await getValidSession(env, token);
    if (!session) {
        headers['Set-Cookie'] = createCookie('', -1);
        return { errorResponse: jsonResponse({ error: 'Invalid or expired session' }, 401, headers) };
    }
    
    // Quick validation before proceeding
    if (!validateSessionSecurity(session, request)) {
       await env.DB.prepare(`DELETE FROM user_sessions WHERE token = ?`).bind(token).run();
       headers['Set-Cookie'] = createCookie('', -1);
       return { errorResponse: jsonResponse({ error: 'Session security validation failed' }, 401, headers) };
    }

    return { user: { id: session.user_id }, headers };
}

/**
 * Decodes a Base64URL encoded string.
 * @param {string} str 
 * @returns {string}
 */
function b64UrlDecode(str) {
    // Convert Base64URL to Base64 by replacing '-' with '+' and '_' with '/'
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Pad with '=' characters if necessary
    const pad = base64.length % 4;
    if (pad) {
        if (pad === 2) base64 += '==';
        else if (pad === 3) base64 += '=';
    }
    return atob(base64);
}

/**
 * Verifies a Google ID token.
 * @param {string} token - The Google ID token.
 * @param {string} clientId - Your Google Client ID.
 * @returns {Promise<object|null>} The token payload if valid, otherwise null.
 */
async function verifyGoogleToken(token, clientId) {
    try {
        // 1. Decode token parts
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        if (!headerB64 || !payloadB64 || !signatureB64) {
            console.error('Invalid JWT structure');
            return null;
        }
        
        const header = JSON.parse(b64UrlDecode(headerB64));
        const payload = JSON.parse(b64UrlDecode(payloadB64));

        // 2. Check basic claims
        if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
            console.error('Invalid issuer:', payload.iss);
            return null;
        }
        if (payload.aud !== clientId) {
            console.error('Invalid audience:', payload.aud);
            return null;
        }
        if (payload.exp * 1000 < Date.now()) {
            console.error('Token expired');
            return null;
        }

        // 3. Verify signature
        const publicKey = await getGooglePublicKey(header.kid);
        if (!publicKey) {
            console.error('Could not fetch Google public key for kid:', header.kid);
            return null;
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(`${headerB64}.${payloadB64}`);
        const signatureDecoded = b64UrlDecode(signatureB64);
        const signature = new Uint8Array(signatureDecoded.split('').map(c => c.charCodeAt(0)));

        const isValid = await crypto.subtle.verify(
            'RSASSA-PKCS1-v1_5',
            publicKey,
            signature,
            data
        );

        if (!isValid) {
            console.error('Invalid signature');
            return null;
        }

        return payload;
    } catch (error) {
        console.error('Error verifying Google token:', error);
        return null;
    }
}

/**
 * Fetches and caches Google's public keys for JWT verification.
 * @param {string} kid - The Key ID from the JWT header.
 * @returns {Promise<CryptoKey|null>}
 */
async function getGooglePublicKey(kid) {
    const now = Date.now();
    if (keyCache.has(kid) && (now - lastKeyFetchTime < KEY_CACHE_TTL)) {
        return keyCache.get(kid);
    }

    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
        if (!response.ok) throw new Error('Failed to fetch Google certs');
        
        const { keys } = await response.json();
        
        // Clear old keys and update cache
        keyCache.clear();
        for (const key of keys) {
            const jwk = {
                kty: key.kty,
                n: key.n,
                e: key.e,
                alg: key.alg,
                kid: key.kid,
                use: key.use,
            };
            const importedKey = await crypto.subtle.importKey(
                'jwk',
                jwk,
                { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                true,
                ['verify']
            );
            keyCache.set(key.kid, importedKey);
        }
        
        lastKeyFetchTime = now;
        return keyCache.get(kid) || null;
        
    } catch (error) {
        console.error('Error fetching/caching Google public keys:', error);
        return null;
    }
}