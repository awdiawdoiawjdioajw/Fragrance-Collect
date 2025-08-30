// A map to cache Google's public keys.
// Keys are key IDs, values are the imported CryptoKey objects.
const keyCache = new Map();
let lastKeyFetchTime = 0;
const KEY_CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    
    // Note: The '/verify' endpoint is kept for JWT validation if needed elsewhere,
    // but the primary login flow now uses '/login'.
    if (url.pathname === '/verify' && request.method === 'POST') {
      return handleVerificationRequest(request, env);
    }
    
    if (url.pathname === '/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }
    
    if (url.pathname === '/logout' && request.method === 'POST') {
      return handleLogout(request, env);
    }
    
        if (url.pathname === '/status' && request.method === 'GET') {
        return handleGetStatus(request, env);
    }
    if (url.pathname === '/token' && request.method === 'GET') {
        return handleGetToken(request, env);
    }

    if (url.pathname === '/signup/email' && request.method === 'POST') {
      return handleEmailSignup(request, env);
    }

    if (url.pathname === '/login/email' && request.method === 'POST') {
      return handleEmailLogin(request, env);
    }

    // --- NEW ACCOUNT FEATURE ENDPOINTS ---
    if (url.pathname === '/api/user/preferences' && request.method === 'GET') {
        return handleGetPreferences(request, env);
    }
    if (url.pathname === '/api/user/preferences' && request.method === 'POST') {
        return handleUpdatePreferences(request, env);
    }
    if (url.pathname === '/api/user/favorites' && request.method === 'GET') {
        return handleGetFavorites(request, env);
    }
    if (url.pathname === '/api/user/favorites' && request.method === 'POST') {
        return handleAddFavorite(request, env);
    }
    if (url.pathname.startsWith('/api/user/favorites/') && request.method === 'DELETE') {
        return handleDeleteFavorite(request, env);
    }

    // API endpoints routing
    const path = url.pathname.replace(/\/+$/, '');
    const segs = path.split('/').filter(Boolean);
    const endpoint = segs[segs.length - 1] || '';

    try {
      switch (endpoint) {
        case '':
          return json({
            ok: true,
            endpoints: ['/health', '/products', '/feeds', '/trending', '/analytics', '/login', '/logout', '/status'],
            version: '2.0.0',
            features: ['multi-store-search', 'revenue-optimization', 'smart-caching', 'integrated-auth']
          }, env);

        case 'health':
          return await handleHealthRequest(env);

        case 'feeds':
          return await handleFeedsRequest(env);

        case 'products':
          return await handleProductsRequest(request, url, env);

        case 'trending':
          return await handleTrendingRequest(env);

        case 'analytics':
          return await handleAnalyticsRequest(request, env);

        case 'test-cj':
          return await handleTestCJRequest(env);

        case 'test-graphql':
          return await handleTestGraphQLRequest(env);

        default:
          const headers = getSecurityHeaders(request.headers.get('Origin'));
          return new Response('Not Found', { status: 404, headers });
      }
    } catch (error) {
      console.error('Worker error:', error);
      const headers = getSecurityHeaders(request.headers.get('Origin'));
      return json({ error: 'An internal worker error occurred', details: error.message }, env, 500);
    }
  },
};

async function handleVerificationRequest(request, env) {
  const origin = request.headers.get('Origin');
  const headers = getSecurityHeaders(origin);
  try {
    const { token } = await request.json();
    const CLIENT_ID = env.GOOGLE_CLIENT_ID;

    if (!token) {
      return jsonResponse({ error: 'Token is required' }, 400, headers);
    }

    // 1. Decode JWT to get header and payload
    const { header, payload, signature } = decodeJwt(token);

    // 2. Get the appropriate Google public key to verify the token's signature
    const publicKey = await getGooglePublicKey(header.kid);
    if (!publicKey) {
      return jsonResponse({ error: 'Could not retrieve public key for verification' }, 500, headers);
    }
    
    // 3. Verify the token's signature
    const isValidSignature = await verifySignature(publicKey, signature, token);
    if (!isValidSignature) {
      return jsonResponse({ error: 'Invalid token signature' }, 401, headers);
    }

    // 4. Verify the token's claims
    verifyClaims(payload, CLIENT_ID);

    const user = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };

    return jsonResponse({ success: true, user }, 200, headers);

  } catch (error) {
    return jsonResponse({ error: 'Token verification failed', details: error.message }, 401, headers);
  }
}

// --- JWT Verification Steps ---

/**
 * Fetches Google's public keys for verifying JWTs. Caches them for performance.
 * @param {string} kid The Key ID from the JWT header.
 * @returns {Promise<CryptoKey|null>}
 */
async function getGooglePublicKey(kid) {
  const now = Date.now();
  if (now - lastKeyFetchTime > KEY_CACHE_TTL) {
    keyCache.clear(); // Clear cache if it's expired
  }

  if (keyCache.has(kid)) {
    return keyCache.get(kid);
  }

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!response.ok) throw new Error('Failed to fetch Google certs');
    const certs = await response.json();

    for (const key of certs.keys) {
      const importedKey = await crypto.subtle.importKey(
        'jwk',
        key,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        true,
        ['verify']
      );
      keyCache.set(key.kid, importedKey);
    }
    lastKeyFetchTime = Date.now();
  } catch (error) {
    console.error('Error fetching/importing Google public keys:', error);
    return null;
  }
  
  return keyCache.get(kid) || null;
}

/**
 * Verifies the JWT's signature using the Web Crypto API.
 */
async function verifySignature(publicKey, signature, token) {
  const tokenParts = token.split('.');
  const dataToVerify = new TextEncoder().encode(tokenParts[0] + '.' + tokenParts[1]);
  return await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    publicKey,
    signature,
    dataToVerify
  );
}

/**
 * Verifies the claims of the JWT payload.
 */
function verifyClaims(payload, audience) {
  // Issuer must be from Google
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error(`Invalid issuer: ${payload.iss}`);
  }

  // Audience must match your app's Client ID
  if (payload.aud !== audience) {
    throw new Error(`Invalid audience: ${payload.aud}`);
  }

  // Token must not be expired
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token has expired');
  }

  return true;
}

// --- Database & Authentication Functions ---

/**
 * Handles user login after Google JWT verification and creates a secure session.
 */
async function handleLogin(request, env) {
  // Validate request origin for security
  const origin = request.headers.get('Origin');
  if (!validateSiteOrigin(request)) {
    console.warn('Login attempt from unauthorized origin:', origin || request.headers.get('Referer'));
    // Still set CORS headers even for unauthorized requests to prevent CORS errors
    const headers = getSecurityHeaders(origin);
    return jsonResponse({ error: 'Unauthorized origin' }, 403, headers);
  }

  const headers = getSecurityHeaders(env.ALLOWED_ORIGIN || 'https://fragrancecollect.com');
  const redirectUrl = `${env.ALLOWED_ORIGIN || 'https://fragrancecollect.com'}/auth.html`;

  try {
    const contentType = request.headers.get('content-type') || '';
    let credential;

    if (contentType.includes('application/json')) {
        // Handles calls from the frontend if needed
        const body = await request.json();
        credential = body.credential;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // Handles the redirect POST from Google
        const formData = await request.formData();
        credential = formData.get('credential');
    }

    if (!credential) {
        return jsonResponse({ error: 'Google credential is required' }, 400, headers);
    }

    // 1. Verify the Google JWT
    const { header, payload, signature } = decodeJwt(credential);
    const publicKey = await getGooglePublicKey(header.kid);
    if (!publicKey) {
        return jsonResponse({ error: 'Could not retrieve public key' }, 500, headers);
    }
    const isValidSignature = await verifySignature(publicKey, signature, credential);
    if (!isValidSignature) {
        return jsonResponse({ error: 'Invalid token signature' }, 401, headers);
    }
    verifyClaims(payload, env.GOOGLE_CLIENT_ID);

    // 2. User data from payload
    const { sub: id, email, name, picture } = payload;
    
    // 3. Create or update the user in the database
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, picture=excluded.picture, updated_at=CURRENT_TIMESTAMP`
    ).bind(id, email, name, picture).run();

    // 4. Create a secure session with fingerprinting
    const sessionId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Get client fingerprinting data for session security
    const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const sessionFingerprint = await generateSessionFingerprint(clientIP, userAgent);

    // Clean up old sessions before creating new one
    await cleanupUserSessions(env, id, token);

    await env.DB.prepare(
        `INSERT INTO user_sessions (id, user_id, token, expires_at, client_ip, user_agent, fingerprint, last_activity) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(sessionId, id, token, expiresAt.toISOString(), clientIP, userAgent, sessionFingerprint).run();

    // 5. Set the session token in a secure, HttpOnly cookie
    // **FIX:** Configure cookie properly for cross-origin requests
    const originUrl = request.headers.get('Origin') ? new URL(request.headers.get('Origin')) : null;
    let cookieString = `session_token=${token}; Expires=${expiresAt.toUTCString()}; Path=/; HttpOnly`;

    // Handle cross-origin cookie setting
    if (originUrl) {
        // For local development (localhost, 127.0.0.1, file://)
        if (originUrl.hostname === '127.0.0.1' || originUrl.hostname === 'localhost' || originUrl.protocol === 'file:') {
            // Don't set Domain for localhost to avoid issues
            cookieString += '; SameSite=None; Secure';
        } else if (originUrl.hostname.includes('workers.dev') || originUrl.hostname.includes('pages.dev')) {
            // For Cloudflare domains
            cookieString += '; SameSite=None; Secure';
        } else if (originUrl.hostname.includes('github.io')) {
            // For GitHub Pages
            cookieString += '; SameSite=None; Secure';
        } else {
            // For other production domains
            cookieString += '; SameSite=None; Secure';
        }
    } else {
        // Fallback for requests without Origin header
        cookieString += '; SameSite=None; Secure';
    }

    headers['Set-Cookie'] = cookieString;
    
    // 6. Redirect the user back to the auth page with success status and user's first name.
    const firstName = name.split(' ')[0];
    const successRedirectUrl = new URL(redirectUrl);
    successRedirectUrl.searchParams.set('status', 'success');
    successRedirectUrl.searchParams.set('name', firstName);

    return new Response(null, {
        status: 302,
        headers: {
            ...headers,
            'Location': successRedirectUrl.toString(),
        }
    });

  } catch (error) {
    console.error('Error during login:', error.message);
    const errorRedirectUrl = new URL(redirectUrl);
    errorRedirectUrl.searchParams.set('error', 'login_failed');
    // Sanitize and pass the specific error reason for debugging
    const reason = error.message.replace(/[^a-zA-Z0-9_]/g, '_');
    errorRedirectUrl.searchParams.set('reason', reason);
    return new Response(null, {
        status: 302,
        headers: {
            ...headers,
            'Location': errorRedirectUrl.toString(),
        }
    });
  }
}

/**
 * Handles user logout by removing the session from the DB and clearing the cookie.
 */
async function handleLogout(request, env) {
    const origin = request.headers.get('Origin');
    const headers = getSecurityHeaders(origin);

    try {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
        const token = cookies.session_token;

        if (token) {
            await env.DB.prepare(`DELETE FROM user_sessions WHERE token = ?`).bind(token).run();
        }

        // Clear the cookie by setting its expiration date to the past
        headers['Set-Cookie'] = `session_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax`;

        return jsonResponse({ success: true, message: 'Logged out successfully' }, 200, headers);
    } catch (error) {
        console.error('Error during logout:', error);
        return jsonResponse({ error: 'Logout failed' }, 500, headers);
    }
}

/**
 * Gets user status by validating the session cookie.
 */
async function handleGetStatus(request, env) {
    const origin = request.headers.get('Origin');
    const headers = getSecurityHeaders(origin);

    try {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
        let token = cookies.session_token;

        // If no cookie token, try Authorization header (cross-origin requests)
        if (!token) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            return jsonResponse({ error: 'Not authenticated' }, 401, headers);
        }

        const session = await env.DB.prepare(
            `SELECT s.*, u.id, u.email, u.name, u.picture 
             FROM user_sessions s JOIN users u ON s.user_id = u.id 
             WHERE s.token = ?`
        ).bind(token).first();

        if (!session || new Date(session.expires_at) < new Date()) {
            // If session is expired or invalid, clear the cookie
            headers['Set-Cookie'] = `session_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax`;
            return jsonResponse({ error: 'Invalid or expired session' }, 401, headers);
        }

        // Validate session security (check for potential hijacking)
        if (!validateSessionSecurity(session, request)) {
            console.warn(`Session security validation failed for user ${session.id} in status check`);
            // Invalidate the suspicious session and clear cookie
            await env.DB.prepare(`DELETE FROM user_sessions WHERE token = ?`).bind(token).run();
            headers['Set-Cookie'] = `session_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax`;
            return jsonResponse({ error: 'Session security validation failed' }, 401, headers);
        }

        // Update last activity timestamp
        await env.DB.prepare(
            `UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE token = ?`
        ).bind(token).run();

        return jsonResponse({
            success: true,
            user: {
                id: session.id,
                email: session.email,
                name: session.name,
                picture: session.picture,
            },
        }, 200, headers);

    } catch (error) {
        console.error('Error getting status:', error);
        return jsonResponse({ error: 'Failed to get user status' }, 500, headers);
    }
}

/**
 * Gets the session token for cross-origin requests (using cookies)
 */
async function handleGetToken(request, env) {
    const origin = request.headers.get('Origin');
    const headers = getSecurityHeaders(origin);

    try {
        console.log('handleGetToken called from origin:', origin);
        const cookieHeader = request.headers.get('Cookie') || '';
        console.log('Cookie header:', cookieHeader);
        
        const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
        const token = cookies.session_token;
        console.log('Extracted token:', token ? 'present' : 'missing');

        if (!token) {
            console.log('No session token found in cookies');
            return jsonResponse({ error: 'Not authenticated' }, 401, headers);
        }

        // Validate the session exists and is valid
        const session = await env.DB.prepare(
            `SELECT s.expires_at FROM user_sessions s WHERE s.token = ?`
        ).bind(token).first();

        if (!session || new Date(session.expires_at) < new Date()) {
            console.log('Session invalid or expired');
            return jsonResponse({ error: 'Invalid or expired session' }, 401, headers);
        }

        console.log('Token retrieved successfully');
        return jsonResponse({ success: true, token }, 200, headers);

    } catch (error) {
        console.error('Error getting token:', error);
        return jsonResponse({ error: 'Failed to get token' }, 500, headers);
    }
}

// --- NEW ACCOUNT FEATURE HANDLERS ---

/**
 * Middleware to get the authenticated user from a session token.
 */
async function getAuthenticatedUser(request, env) {
    // Try to get token from cookie first (same-origin requests)
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')));
    let token = cookies.session_token;

    // If no cookie token, try Authorization header (cross-origin requests)
    if (!token) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    if (!token) {
        return null;
    }

    const session = await env.DB.prepare(
        `SELECT s.*, u.id, u.email, u.name 
         FROM user_sessions s JOIN users u ON s.user_id = u.id 
         WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP`
    ).bind(token).first();

    if (!session) {
        return null;
    }

    // Validate session security (check for potential hijacking)
    if (!validateSessionSecurity(session, request)) {
        console.warn(`Session security validation failed for user ${session.id}`);
        // Invalidate the suspicious session
        await env.DB.prepare(`DELETE FROM user_sessions WHERE token = ?`).bind(token).run();
        return null;
    }

    // Update last activity timestamp
    await env.DB.prepare(
        `UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE token = ?`
    ).bind(token).run();

    return { id: session.id, email: session.email, name: session.name }; // Returns user object or null
}

async function handleGetPreferences(request, env) {
    const user = await getAuthenticatedUser(request, env);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const prefs = await env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(user.id).first();
    
    return jsonResponse({ success: true, preferences: prefs || {} });
}

async function handleUpdatePreferences(request, env) {
    const user = await getAuthenticatedUser(request, env);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const prefs = await request.json();
    
    await env.DB.prepare(
        `INSERT INTO user_preferences (user_id, scent_categories, intensity, season, occasion, budget_range, sensitivities) 
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           scent_categories=excluded.scent_categories,
           intensity=excluded.intensity,
           season=excluded.season,
           occasion=excluded.occasion,
           budget_range=excluded.budget_range,
           sensitivities=excluded.sensitivities,
           updated_at=CURRENT_TIMESTAMP`
    ).bind(user.id, JSON.stringify(prefs.scent_categories || []), prefs.intensity, prefs.season, prefs.occasion, prefs.budget_range, prefs.sensitivities).run();

    return jsonResponse({ success: true, message: 'Preferences updated.' });
}

async function handleGetFavorites(request, env) {
    const origin = request.headers.get('Origin');
    const headers = getSecurityHeaders(origin);
    
    const user = await getAuthenticatedUser(request, env);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, headers);

    const { results } = await env.DB.prepare('SELECT * FROM user_favorites WHERE user_id = ? ORDER BY added_at DESC').bind(user.id).all();

    return jsonResponse({ success: true, favorites: results || [] }, 200, headers);
}

async function handleAddFavorite(request, env) {
    const origin = request.headers.get('Origin');
    const headers = getSecurityHeaders(origin);
    
    const user = await getAuthenticatedUser(request, env);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, headers);

    const fav = await request.json();
    if (!fav || !fav.fragrance_id || !fav.name) {
        return jsonResponse({ error: 'Fragrance ID and name are required' }, 400, headers);
    }

    const favoriteId = crypto.randomUUID();

    try {
        await env.DB.prepare(
            `INSERT INTO user_favorites (id, user_id, fragrance_id, name, advertiserName, description, imageUrl, productUrl, price, currency, shipping_availability) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            favoriteId, user.id, fav.fragrance_id, fav.name, fav.advertiserName, 
            fav.description, fav.imageUrl, fav.productUrl, fav.price, 
            fav.currency, fav.shipping_availability
        ).run();
    } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
            return jsonResponse({ success: true, message: 'Already in favorites.' }, 200, headers);
        }
        console.error('Failed to add favorite:', e);
        return jsonResponse({ error: 'Failed to add favorite.' }, 500, headers);
    }
    
    return jsonResponse({ success: true, message: 'Added to favorites.', favorite_id: favoriteId }, 201, headers);
}

async function handleDeleteFavorite(request, env) {
    const origin = request.headers.get('Origin');
    const headers = getSecurityHeaders(origin);
    
    const user = await getAuthenticatedUser(request, env);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401, headers);

    const url = new URL(request.url);
    const fragranceId = url.pathname.split('/').pop();

    if (!fragranceId) return jsonResponse({ error: 'Fragrance ID is required in URL' }, 400, headers);

    await env.DB.prepare(
        'DELETE FROM user_favorites WHERE user_id = ? AND fragrance_id = ?'
    ).bind(user.id, fragranceId).run();

    return jsonResponse({ success: true, message: 'Removed from favorites.' }, 200, headers);
}


/**
 * Handles user sign-up with email and password.
 */
async function handleEmailSignup(request, env) {
    // Validate request origin for security
    const origin = request.headers.get('Origin');
    if (!validateSiteOrigin(request)) {
        console.warn('Email signup attempt from unauthorized origin:', origin || request.headers.get('Referer'));
        // Still set CORS headers even for unauthorized requests to prevent CORS errors
        const headers = getSecurityHeaders(origin);
        return jsonResponse({ error: 'Unauthorized origin' }, 403, headers);
    }

    const headers = getSecurityHeaders(origin);
    try {
        const { name, email, password } = await request.json();

        if (!name || !email || !password) {
            return jsonResponse({ error: 'Name, email, and password are required.' }, 400, headers);
        }

        // Check if user already exists
        const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existingUser) {
            return jsonResponse({ error: 'A user with this email already exists.' }, 409, headers);
        }
        
        // Hash the password
        const passwordHash = await sha512(password);
        const userId = crypto.randomUUID();

        // Store the new user
        await env.DB.prepare(
            `INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`
        ).bind(userId, name, email, passwordHash).run();
        
        // Create a session for the new user
        const sessionId = crypto.randomUUID();
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Get client fingerprinting data for session security
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        const userAgent = request.headers.get('User-Agent') || 'unknown';
        const sessionFingerprint = await generateSessionFingerprint(clientIP, userAgent);

        // Clean up old sessions before creating new one
        await cleanupUserSessions(env, userId, token);

        await env.DB.prepare(
            `INSERT INTO user_sessions (id, user_id, token, expires_at, client_ip, user_agent, fingerprint, last_activity) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(sessionId, userId, token, expiresAt.toISOString(), clientIP, userAgent, sessionFingerprint).run();

            // **FIX:** Configure cookie properly for cross-origin requests
    const originUrl = request.headers.get('Origin') ? new URL(request.headers.get('Origin')) : null;
    let cookieString = `session_token=${token}; Expires=${expiresAt.toUTCString()}; Path=/; HttpOnly`;

    // Handle cross-origin cookie setting
    if (originUrl) {
        // For local development (localhost, 127.0.0.1, file://)
        if (originUrl.hostname === '127.0.0.1' || originUrl.hostname === 'localhost' || originUrl.protocol === 'file:') {
            // Don't set Domain for localhost to avoid issues
            cookieString += '; SameSite=None; Secure';
        } else if (originUrl.hostname.includes('workers.dev') || originUrl.hostname.includes('pages.dev')) {
            // For Cloudflare domains
            cookieString += '; SameSite=None; Secure';
        } else if (originUrl.hostname.includes('github.io')) {
            // For GitHub Pages
            cookieString += '; SameSite=None; Secure';
        } else {
            // For other production domains
            cookieString += '; SameSite=None; Secure';
        }
    } else {
        // Fallback for requests without Origin header
        cookieString += '; SameSite=None; Secure';
    }

        headers['Set-Cookie'] = cookieString;

        // Also include token in response for localStorage fallback
        const responseData = { 
            success: true, 
            user: { id: userId, name, email },
            token: token // Include token for localStorage storage
        };
        return jsonResponse(responseData, 201, headers);

    } catch (error) {
        console.error('Error during email signup:', error);
        return jsonResponse({ error: 'Signup failed.', details: error.message }, 500, headers);
    }
}

/**
 * Handles user login with email and password.
 */
async function handleEmailLogin(request, env) {
    // Validate request origin for security
    const origin = request.headers.get('Origin');
    if (!validateSiteOrigin(request)) {
        console.warn('Email login attempt from unauthorized origin:', origin || request.headers.get('Referer'));
        // Still set CORS headers even for unauthorized requests to prevent CORS errors
        const headers = getSecurityHeaders(origin);
        return jsonResponse({ error: 'Unauthorized origin' }, 403, headers);
    }

    const headers = getSecurityHeaders(origin);
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return jsonResponse({ error: 'Email and password are required.' }, 400, headers);
        }

        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (!user || !user.password_hash) {
            return jsonResponse({ error: 'Invalid email or password.' }, 401, headers);
        }
        
        const passwordHash = await sha512(password);
        
        // Constant-time comparison to prevent timing attacks
        if (passwordHash.length !== user.password_hash.length) {
          return jsonResponse({ error: 'Invalid email or password.' }, 401, headers);
        }

        let diff = 0;
        for (let i = 0; i < passwordHash.length; i++) {
            diff |= passwordHash.charCodeAt(i) ^ user.password_hash.charCodeAt(i);
        }

        if (diff !== 0) {
            return jsonResponse({ error: 'Invalid email or password.' }, 401, headers);
        }

        const sessionId = crypto.randomUUID();
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Get client fingerprinting data for session security
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        const userAgent = request.headers.get('User-Agent') || 'unknown';
        const sessionFingerprint = await generateSessionFingerprint(clientIP, userAgent);

        // Clean up old sessions before creating new one
        await cleanupUserSessions(env, user.id, token);

        await env.DB.prepare(
            `INSERT INTO user_sessions (id, user_id, token, expires_at, client_ip, user_agent, fingerprint, last_activity) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(sessionId, user.id, token, expiresAt.toISOString(), clientIP, userAgent, sessionFingerprint).run();

            // **FIX:** Configure cookie properly for both local development and production
    const originUrl = request.headers.get('Origin') ? new URL(request.headers.get('Origin')) : null;
    let cookieString = `session_token=${token}; Expires=${expiresAt.toUTCString()}; Path=/; HttpOnly`;

    // Handle cross-origin cookie setting
    if (originUrl) {
        // For local development (localhost, 127.0.0.1, file://)
        if (originUrl.hostname === '127.0.0.1' || originUrl.hostname === 'localhost' || originUrl.protocol === 'file:') {
            // Don't set Domain for localhost to avoid issues
            cookieString += '; SameSite=None; Secure';
        } else if (originUrl.hostname.includes('workers.dev') || originUrl.hostname.includes('pages.dev')) {
            // For Cloudflare domains
            cookieString += '; SameSite=None; Secure';
        } else if (originUrl.hostname.includes('github.io')) {
            // For GitHub Pages
            cookieString += '; SameSite=None; Secure';
        } else {
            // For other production domains
            cookieString += '; SameSite=None; Secure';
        }
    } else {
        // Fallback for requests without Origin header
        cookieString += '; SameSite=None; Secure';
    }

        headers['Set-Cookie'] = cookieString;

        // **FIX:** Return a JSON response instead of a redirect
        // Also include token in response for localStorage fallback
        const responseData = {
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                picture: user.picture
            },
            token: token // Include token for localStorage storage
        };
        return jsonResponse(responseData, 200, headers);

    } catch (error) {
        console.error('Error during email login:', error.message);
        return jsonResponse({ error: 'Login failed.', details: error.message }, 500, headers);
    }
}


// --- Password Hashing Utilities ---

/**
 * Hashes a string using SHA-512.
 * @param {string} str The string to hash.
 * @returns {Promise<string>} The hex-encoded hash.
 */
async function sha512(str) {
  const buffer = await crypto.subtle.digest(
    'SHA-512',
    new TextEncoder().encode(str)
  );
  const hashArray = Array.from(new Uint8Array(buffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// --- Utility Functions ---

/**
 * Allowed origins for CORS - only these domains can make requests to the auth worker
 */
const ALLOWED_ORIGINS = [
    'https://fragrancecollect.com',
    'https://www.fragrancecollect.com',
    'https://fragrance-collect.pages.dev', // Cloudflare Pages preview
    'https://fragrance-collect.github.io', // GitHub Pages repo
    'https://heart.github.io', // GitHub Pages user domain
    'https://heart.github.io/Fragrance-Collect', // GitHub Pages project
    'https://heart.github.io/fragrance-collect', // GitHub Pages project (lowercase)
    'http://localhost:3000', // Local development
    'http://localhost:8080', // Local development
    'http://localhost:5000', // Local development
    'http://localhost:8000', // Local development
    'http://127.0.0.1:3000', // Local development
    'http://127.0.0.1:8080', // Local development
    'http://127.0.0.1:5000', // Local development
    'http://127.0.0.1:8000', // Local development
    'http://localhost:5500', // VS Code Live Server
    'http://localhost:4000', // Jekyll default
    'http://localhost:4001', // Alternative Jekyll
    'http://localhost:5173', // Vite dev server
    'http://localhost:5174', // Alternative Vite
    'http://localhost:3001', // React dev server alternative
    'http://localhost:8001', // Alternative development
    'http://127.0.0.1:5500', // VS Code Live Server
    'http://127.0.0.1:4000', // Jekyll default
    'http://127.0.0.1:5173', // Vite dev server
    'http://127.0.0.1:5174', // Alternative Vite
    'http://127.0.0.1:3001', // React dev server alternative
    'http://127.0.0.1:8001', // Alternative development
    'https://localhost:3000', // HTTPS localhost
    'https://localhost:8080', // HTTPS localhost
    'https://localhost:5000', // HTTPS localhost
    'https://localhost:8000', // HTTPS localhost
    'https://127.0.0.1:3000', // HTTPS localhost
    'https://127.0.0.1:8080', // HTTPS localhost
    'https://127.0.0.1:5000', // HTTPS localhost
    'https://127.0.0.1:8000', // HTTPS localhost
    'https://localhost:5500', // HTTPS VS Code Live Server
    'https://localhost:5173', // HTTPS Vite
    'https://localhost:5174', // HTTPS Alternative Vite
    'file://', // For local file testing
    null, // For direct navigation
    undefined // For direct navigation
];

/**
 * Validates if the origin is allowed to make requests
 */
function isOriginAllowed(origin) {
    if (!origin || origin === 'null' || origin === 'undefined') {
        console.log('No origin provided, allowing for direct navigation');
        return true; // Allow direct navigation
    }

    // Allow file:// protocol for local file testing
    if (origin.startsWith('file://')) {
        console.log('File protocol allowed for local testing:', origin);
        return true;
    }

    // Allow localhost and 127.0.0.1 with any port (HTTP and HTTPS)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        console.log('Localhost/127.0.0.1 origin allowed:', origin);
        return true;
    }

    // Allow any GitHub Pages domain
    if (origin.includes('.github.io')) {
        console.log('GitHub Pages origin allowed:', origin);
        return true;
    }

    // Allow Cloudflare Pages domains
    if (origin.includes('.pages.dev')) {
        console.log('Cloudflare Pages origin allowed:', origin);
        return true;
    }

    // Allow common development ports on any localhost-like domain
    try {
        const url = new URL(origin);
        const commonDevPorts = ['3000', '3001', '4000', '4001', '5000', '5173', '5174', '5500', '8000', '8001', '8080'];
        if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.includes('localhost')) &&
            commonDevPorts.includes(url.port)) {
            console.log('Common dev port allowed:', origin);
            return true;
        }
    } catch (e) {
        // Invalid URL, continue with normal checks
    }

    // Check against allowed origins list
    const isAllowed = ALLOWED_ORIGINS.includes(origin);
    console.log('Origin check result:', origin, 'allowed:', isAllowed);
    return isAllowed;
}

/**
 * Validates the request origin and referrer for additional security
 */
function validateSiteOrigin(request) {
    const origin = request.headers.get('Origin');
    const referer = request.headers.get('Referer');
    
    // Log for debugging
    console.log('Origin validation - Origin:', origin, 'Referer:', referer);
    
    // For non-CORS requests, check referer
    if (!origin && referer) {
        try {
            const refererUrl = new URL(referer);
            const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
            console.log('Checking referer origin:', refererOrigin);
            return isOriginAllowed(refererOrigin);
        } catch (e) {
            console.log('Failed to parse referer:', e.message);
            return false;
        }
    }
    
    // For CORS requests, check origin
    if (origin) {
        console.log('Checking origin:', origin, 'Allowed:', isOriginAllowed(origin));
        return isOriginAllowed(origin);
    }
    
    // No origin or referer - allow for direct navigation
    console.log('No origin or referer - allowing for direct navigation');
    return true; // More permissive for now
}

/**
 * Creates a standard set of security headers for all responses.
 * @param {string} origin - The request's origin for CORS.
 * @returns {HeadersInit}
 */
function getSecurityHeaders(origin) {
    const csp = [
        "default-src 'self'",
        "script-src 'self' https://accounts.google.com 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' data: https: *.googleusercontent.com",
        "connect-src 'self' https://www.googleapis.com",
        "frame-src 'self' https://accounts.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');

    const headers = {
        'Content-Security-Policy': csp,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };

    // Determine allowed origin value
    let allowedOrigin = null;
    if (!origin || origin === 'null' || origin === 'undefined') {
        // Support file:// and other null-origin contexts
        allowedOrigin = 'null';
    } else if (isOriginAllowed(origin)) {
        allowedOrigin = origin;
    }

    if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
    } else if (origin) {
        console.log('Origin not allowed for CORS:', origin);
    }

    return headers;
}

/**
 * Decodes a JWT into its three parts without verifying the signature.
 */
function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT structure');
  }
  const header = JSON.parse(decodeBase64Url(parts[0]));
  const payload = JSON.parse(decodeBase64Url(parts[1]));
  const signature = base64UrlToArrayBuffer(parts[2]);
  
  return { header, payload, signature };
}

function decodeBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

function base64UrlToArrayBuffer(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function handleOptions(request) {
  const origin = request.headers.get('Origin');
  const headers = getSecurityHeaders(origin);

  if (
    origin !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Proper CORS preflight request
    return new Response(null, { headers });
  } else {
    // Fallback for non-CORS preflight requests
    const fallbackHeaders = {
      ...headers,
      Allow: 'GET, POST, OPTIONS'
    };
    return new Response(null, { headers: fallbackHeaders });
  }
}

// --- SECURITY FUNCTIONS ---

/**
 * Generate a session fingerprint for additional security
 */
async function generateSessionFingerprint(clientIP, userAgent) {
    const data = `${clientIP}:${userAgent}:${Date.now()}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate session security by checking IP and User-Agent
 */
function validateSessionSecurity(session, request) {
    const currentIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const currentUserAgent = request.headers.get('User-Agent') || 'unknown';
    
    // Allow some flexibility for mobile networks and proxy changes
    // But flag suspicious changes
    const ipChanged = session.client_ip && session.client_ip !== currentIP;
    const userAgentChanged = session.user_agent && session.user_agent !== currentUserAgent;
    
    // If both IP and User-Agent changed, it's likely session hijacking
    if (ipChanged && userAgentChanged) {
        console.warn(`Suspicious session activity: IP changed from ${session.client_ip} to ${currentIP}, UA changed`);
        return false;
    }
    
    return true;
}

/**
 * Clean up expired and old sessions for a user (prevent session accumulation)
 */
async function cleanupUserSessions(env, userId, keepCurrentToken = null) {
    // Keep only the 3 most recent sessions per user, plus the current one
    const query = `
        DELETE FROM user_sessions 
        WHERE user_id = ? 
        AND token != COALESCE(?, '') 
        AND (expires_at < CURRENT_TIMESTAMP 
             OR id NOT IN (
                 SELECT id FROM user_sessions 
                 WHERE user_id = ? 
                 ORDER BY last_activity DESC 
                 LIMIT 3
             ))
    `;
    
    await env.DB.prepare(query).bind(userId, keepCurrentToken, userId).run();
}

function jsonResponse(data, status = 200, headers = {}) {
  const finalHeaders = {
      ...headers,
      'Content-Type': 'application/json'
  };
  return new Response(JSON.stringify(data), { status, headers: finalHeaders });
}

// --- API FUNCTIONS ---

async function handleHealthRequest(env) {
  return json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['multi-store-search', 'revenue-optimization', 'smart-caching', 'integrated-auth']
  }, env);
}

async function handleFeedsRequest(env) {
  if (!env.CJ_DEV_KEY || !env.CJ_COMPANY_ID) {
    return json({ error: 'Missing required credentials for feed lookup: CJ_DEV_KEY, CJ_COMPANY_ID' }, env, 500);
  }

  const query = `
    query productFeeds($companyId: ID!) {
      productFeeds(companyId: $companyId) {
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
    companyId: env.CJ_COMPANY_ID
  };

  const gqlRes = await fetch('https://ads.api.cj.com/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CJ_DEV_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, */*'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!gqlRes.ok) {
    const errorText = await gqlRes.text();
    return json({ error: 'CJ GraphQL API error (feeds)', status: gqlRes.status, details: errorText }, env, gqlRes.status);
  }

  const gqlData = await gqlRes.json();
  if (gqlData.errors) {
    return json({ error: 'CJ GraphQL API error (feeds)', details: gqlData.errors }, env, 500);
  }

  return json(gqlData.data.productFeeds.resultList || [], env);
}

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
  const sortBy = searchParams.get('sortBy') || 'price_low';
  const brandFilter = searchParams.get('brand') || null;

  const cacheKey = generateCacheKey({
    query, limit, page, lowPrice, highPrice, partnerId,
    includeTikTok, sortBy, brandFilter
  });

  const cache = caches.default;
  let response = await cache.match(new Request(`https://cache/${cacheKey}`));

  if (response) {
    return response;
  }

  try {
    const cjProducts = await searchCJStore(query, 250, 0, lowPrice, highPrice, partnerId, env);
    let tiktokProducts = [];
    if (includeTikTok && !partnerId) {
      tiktokProducts = await searchTikTokStore(query, 100, 0, lowPrice, highPrice, env);
    }

    if (cjProducts.length === 0 && tiktokProducts.length > 0) {
      tiktokProducts = await searchTikTokStore(query, 200, 0, lowPrice, highPrice, env);
    }

    const allProducts = [...cjProducts, ...tiktokProducts];
    const deduplicatedProducts = deduplicateProducts(allProducts);
    const optimizedProducts = optimizeForRevenue(deduplicatedProducts, query, sortBy, brandFilter);
    const products = optimizedProducts.map(p => formatProductForRevenue(p, query)).filter(Boolean);

    const total = products.length;
    const paginatedProducts = products.slice(offset, offset + limit);
    const revenueMetrics = calculateRevenueMetrics(paginatedProducts, cjProducts.length, tiktokProducts.length);

    const jsonResponse = {
      products: paginatedProducts,
      total,
      page,
      limit,
      hasMore: total > (offset + limit),
      searchQuery: query,
      filters: { lowPrice, highPrice, partnerId, includeTikTok, sortBy, brandFilter },
      revenue: revenueMetrics,
      sources: {
        cj: cjProducts.length,
        tiktok: tiktokProducts.length,
        total: optimizedProducts.length
      },
      optimization: {
        strategy: 'revenue-maximization',
        commissionWeighting: 'CJ-70%-TikTok-30%',
        smartFallback: cjProducts.length === 0 && tiktokProducts.length > 0
      }
    };

    response = json(jsonResponse, env);

    const cacheDuration = determineCacheDuration(query, sortBy);
    const cacheResponse = response.clone();
    cacheResponse.headers.set('Cache-Control', `s-maxage=${cacheDuration}`);
    await cache.put(new Request(`https://cache/${cacheKey}`), cacheResponse);

    return response;

  } catch (error) {
    return json({ error: 'Failed to fetch products from stores', details: error.message }, env, 500);
  }
}

async function handleTrendingRequest(env) {
  return json({
    trending: ['luxury perfume', 'designer fragrance', 'viral perfume', 'limited edition'],
    timestamp: new Date().toISOString()
  }, env);
}

async function handleAnalyticsRequest(request, env) {
  return json({
    message: 'Analytics endpoint - coming soon',
    timestamp: new Date().toISOString()
  }, env);
}

async function handleTestCJRequest(env) {
  if (!env.CJ_DEV_KEY || !env.CJ_COMPANY_ID || !env.CJ_WEBSITE_ID) {
    const missing = [
      !env.CJ_DEV_KEY && "CJ_DEV_KEY",
      !env.CJ_COMPANY_ID && "CJ_COMPANY_ID",
      !env.CJ_WEBSITE_ID && "CJ_WEBSITE_ID"
    ].filter(Boolean).join(', ');
    return json({ error: `Missing required credentials: ${missing}` }, env, 500);
  }

  const query = `
    query testQuery($companyId: ID!) {
      productFeeds(companyId: $companyId) {
        totalCount
        resultList {
          advertiserId
          advertiserName
        }
      }
    }
  `;

  const variables = {
    companyId: env.CJ_COMPANY_ID
  };

  try {
    const gqlRes = await fetch('https://ads.api.cj.com/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CJ_DEV_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, */*'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!gqlRes.ok) {
      const errorText = await gqlRes.text();
      return json({
        error: 'CJ GraphQL API test failed',
        status: gqlRes.status,
        details: errorText,
        env: {
          hasCJ_DEV_KEY: !!env.CJ_DEV_KEY,
          hasCJ_COMPANY_ID: !!env.CJ_COMPANY_ID,
          hasCJ_WEBSITE_ID: !!env.CJ_WEBSITE_ID,
          companyIdValue: env.CJ_COMPANY_ID,
          websiteIdValue: env.CJ_WEBSITE_ID
        }
      }, env, gqlRes.status);
    }

    const gqlData = await gqlRes.json();
    if (gqlData.errors) {
      return json({
        error: 'CJ GraphQL API returned errors',
        details: gqlData.errors,
        env: {
          hasCJ_DEV_KEY: !!env.CJ_DEV_KEY,
          hasCJ_COMPANY_ID: !!env.CJ_COMPANY_ID,
          hasCJ_WEBSITE_ID: !!env.CJ_WEBSITE_ID,
          companyIdValue: env.CJ_COMPANY_ID,
          websiteIdValue: env.CJ_WEBSITE_ID
        }
      }, env, 400);
    }

    return json({
      success: true,
      message: 'CJ API connection successful',
      data: gqlData.data,
      env: {
        hasCJ_DEV_KEY: !!env.CJ_DEV_KEY,
        hasCJ_COMPANY_ID: !!env.CJ_COMPANY_ID,
        hasCJ_WEBSITE_ID: !!env.CJ_WEBSITE_ID,
        companyIdValue: env.CJ_COMPANY_ID,
        websiteIdValue: env.CJ_WEBSITE_ID
      }
    }, env);

  } catch (error) {
    return json({
      error: 'Failed to test CJ GraphQL API',
      details: error.message,
      env: {
        hasCJ_DEV_KEY: !!env.CJ_DEV_KEY,
        hasCJ_COMPANY_ID: !!env.CJ_COMPANY_ID,
        hasCJ_WEBSITE_ID: !!env.CJ_WEBSITE_ID,
        companyIdValue: env.CJ_COMPANY_ID,
        websiteIdValue: env.CJ_WEBSITE_ID
      }
    }, env, 500);
  }
}

async function handleTestGraphQLRequest(env) {
  if (!env.CJ_DEV_KEY || !env.CJ_COMPANY_ID) {
    const missing = [
      !env.CJ_DEV_KEY && "CJ_DEV_KEY",
      !env.CJ_COMPANY_ID && "CJ_COMPANY_ID"
    ].filter(Boolean).join(', ');
    return json({ error: `Missing required credentials: ${missing}` }, env, 500);
  }

  const query = `
    query testQuery($companyId: ID!) {
      productFeeds(companyId: $companyId) {
        totalCount
        resultList {
          advertiserId
          advertiserName
        }
      }
    }
  `;

  const variables = {
    companyId: env.CJ_COMPANY_ID
  };

  try {
    const gqlRes = await fetch('https://ads.api.cj.com/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CJ_DEV_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, */*'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!gqlRes.ok) {
      const errorText = await gqlRes.text();
      return json({
        error: 'CJ GraphQL API test failed (raw response)',
        status: gqlRes.status,
        details: errorText,
        env: {
          hasCJ_DEV_KEY: !!env.CJ_DEV_KEY,
          hasCJ_COMPANY_ID: !!env.CJ_COMPANY_ID,
          companyIdValue: env.CJ_COMPANY_ID
        }
      }, env, gqlRes.status);
    }

    const gqlData = await gqlRes.json();
    return json({
      success: true,
      message: 'CJ GraphQL API test successful (raw response)',
      data: gqlData,
      env: {
        hasCJ_DEV_KEY: !!env.CJ_DEV_KEY,
        hasCJ_COMPANY_ID: !!env.CJ_COMPANY_ID,
        companyIdValue: env.CJ_COMPANY_ID
      }
    }, env);

  } catch (error) {
    return json({
      error: 'Failed to test CJ GraphQL API (raw response)',
      details: error.message,
      env: {
        hasCJ_DEV_KEY: !!env.CJ_DEV_KEY,
        hasCJ_COMPANY_ID: !!env.CJ_COMPANY_ID,
        companyIdValue: env.CJ_COMPANY_ID
      }
    }, env, 500);
  }
}

// Helper functions for API
async function searchCJStore(query, limit, offset, lowPrice, highPrice, partnerId, env) {
  const gqlQuery = buildShoppingProductsQuery(!!partnerId);

  if (query) {
    const gqlVariables = {
      companyId: env.CJ_COMPANY_ID,
      keywords: query.split(/\s+/).filter(k => k.length > 0),
      limit: Math.min(limit * 2, 400),
      offset,
      websiteId: env.CJ_WEBSITE_ID,
      lowPrice,
      highPrice,
      partnerIds: partnerId ? [partnerId] : null
    };

    const gqlData = await fetchCJProducts(gqlQuery, gqlVariables, env);
    return gqlData.data?.shoppingProducts?.resultList || [];
  } else {
    const revenueKeywords = [
      'luxury perfume', 'designer fragrance', 'niche perfume',
      'celebrity fragrance', 'limited edition perfume', 'exclusive fragrance'
    ];
    const limitPerKeyword = Math.ceil(limit / revenueKeywords.length);

    const promises = revenueKeywords.map(keyword => {
      const gqlVariables = {
        companyId: env.CJ_COMPANY_ID,
        keywords: [keyword],
        limit: limitPerKeyword,
        offset: 0,
        websiteId: env.CJ_WEBSITE_ID,
        lowPrice,
        highPrice,
        partnerIds: partnerId ? [partnerId] : null
      };
      return fetchCJProducts(gqlQuery, gqlVariables, env);
    });

    const results = await Promise.allSettled(promises);
    const productMap = new Map();

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const products = result.value.data?.shoppingProducts?.resultList || [];
        products.forEach(p => productMap.set(p.id, p));
      }
    });

    return Array.from(productMap.values());
  }
}

async function searchTikTokStore(query, limit, offset, lowPrice, highPrice, env) {
  try {
    const gqlQuery = buildShoppingProductsQuery(true);

    if (query) {
      const gqlVariables = {
        companyId: env.CJ_COMPANY_ID,
        keywords: query.split(/\s+/).filter(k => k.length > 0),
        limit: Math.min(limit * 2, 200),
        offset,
        websiteId: env.CJ_WEBSITE_ID,
        lowPrice,
        highPrice,
        partnerIds: [REVENUE_CONFIG.TIKTOK_PARTNER_ID]
      };

      const gqlData = await fetchCJProducts(gqlQuery, gqlVariables, env);
      return gqlData.data?.shoppingProducts?.resultList || [];
    } else {
      const tiktokKeywords = ['viral perfume', 'trending fragrance', 'tiktok perfume', 'social media fragrance'];
      const limitPerKeyword = Math.ceil(limit / tiktokKeywords.length);

      const promises = tiktokKeywords.map(keyword => {
        const gqlVariables = {
          companyId: env.CJ_COMPANY_ID,
          keywords: [keyword],
          limit: limitPerKeyword,
          offset: 0,
          websiteId: env.CJ_WEBSITE_ID,
          lowPrice,
          highPrice,
          partnerIds: [REVENUE_CONFIG.TIKTOK_PARTNER_ID]
        };
        return fetchCJProducts(gqlQuery, gqlVariables, env);
      });

      const results = await Promise.allSettled(promises);
      const productMap = new Map();

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const products = result.value.data?.shoppingProducts?.resultList || [];
          products.forEach(p => productMap.set(p.id, p));
        }
      });

      return Array.from(productMap.values());
    }
  } catch (error) {
    return [];
  }
}

function optimizeForRevenue(products, query, sortBy, brandFilter) {
  let filtered = products.filter(p => {
    if (brandFilter && p.brand?.toLowerCase() !== brandFilter.toLowerCase()) return false;
    return true;
  });

  filtered = filtered.map(p => ({
    ...p,
    revenueScore: calculateRevenueScore(p, query),
    commissionRate: getCommissionRate(p),
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
    case 'relevance':
    default:
      return filtered.sort((a, b) => parseFloat(a.price?.amount || 0) - parseFloat(b.price?.amount || 0));
  }
}

function calculateRevenueScore(product, query) {
  let score = 0;

  const commissionRate = getCommissionRate(product);
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

function getCommissionRate(product) {
  if (!product.linkCode?.clickUrl) {
    return 0;
  }
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

function formatProductForRevenue(p, query) {
  const cjLink = p.linkCode?.clickUrl || p.link;

  if (!cjLink || !p.imageLink) {
    return null;
  }

  const price = parseFloat(p.price?.amount || 0);
  const commissionRate = getCommissionRate(p);
  const estimatedCommission = price * commissionRate;

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
    source: p.advertiserName?.includes('TikTok') ? 'TikTok Shop' : 'CJ Store',
    revenue: {
      commissionRate: commissionRate,
      estimatedCommission: estimatedCommission,
      commissionDisplay: `Earn $${estimatedCommission.toFixed(2)} per click`,
      category: getBrandCategory(p)
    },
    trending: {
      score: calculateTrendingScore(p),
      isTrending: calculateTrendingScore(p) > 20,
      badges: generateTrendingBadges(p)
    },
    relevance: calculateRelevance(p, query)
  };
}

function generateTrendingBadges(product) {
  const badges = [];
  const title = product.title?.toLowerCase() || '';

  if (title.includes('limited edition')) badges.push('Limited Edition');
  if (title.includes('viral') || title.includes('trending')) badges.push('Trending');
  if (title.includes('tiktok')) badges.push('TikTok Viral');
  if (title.includes('luxury')) badges.push('Luxury');
  if (title.includes('designer')) badges.push('Designer');

  return badges;
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

function calculateRevenueMetrics(products, cjCount, tiktokCount) {
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + (p.price || 0), 0);
  const avgCommission = products.reduce((sum, p) => sum + (p.revenue?.commissionRate || 0), 0) / totalProducts;
  const estimatedTotalCommission = products.reduce((sum, p) => sum + (p.revenue?.estimatedCommission || 0), 0);

  return {
    totalProducts,
    totalValue: totalValue.toFixed(2),
    averageCommission: avgCommission.toFixed(3),
    estimatedTotalCommission: estimatedTotalCommission.toFixed(2),
    cjContribution: cjCount / totalProducts,
    tiktokContribution: tiktokCount / totalProducts,
    revenueOptimization: 'active'
  };
}

function generateCacheKey(params) {
  const { query, limit, page, lowPrice, highPrice, partnerId, includeTikTok, sortBy, brandFilter } = params;
  return `products:${query}:${limit}:${page}:${lowPrice}:${highPrice}:${partnerId}:${includeTikTok}:${sortBy}:${brandFilter}`;
}

function determineCacheDuration(query, sortBy) {
  if (!query) return REVENUE_CONFIG.GENERIC_CACHE_DURATION;

  const queryLower = query.toLowerCase();

  if (queryLower.includes('viral') || queryLower.includes('trending') || queryLower.includes('new')) {
    return REVENUE_CONFIG.TRENDING_CACHE_DURATION;
  }

  if (queryLower.includes('chanel') || queryLower.includes('dior') || queryLower.includes('gucci')) {
    return REVENUE_CONFIG.BRAND_CACHE_DURATION;
  }

  if (queryLower.includes('christmas') || queryLower.includes('holiday') || queryLower.includes('summer')) {
    return REVENUE_CONFIG.SEASONAL_CACHE_DURATION;
  }

  if (queryLower.includes('perfume') || queryLower.includes('fragrance')) {
    return REVENUE_CONFIG.HOT_SEARCH_CACHE_DURATION;
  }

  return REVENUE_CONFIG.GENERIC_CACHE_DURATION;
}

function deduplicateProducts(products) {
  const seen = new Map();
  const unique = [];

  products.forEach(product => {
    const key = `${product.title?.toLowerCase()}-${product.brand?.toLowerCase()}-${product.price?.amount}`;

    if (!seen.has(key)) {
      seen.set(key, true);
      unique.push(product);
    }
  });

  return unique;
}

async function fetchCJProducts(gqlQuery, variables, env) {
  const gqlRes = await fetch('https://ads.api.cj.com/query', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.CJ_DEV_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json, */*' },
    body: JSON.stringify({ query: gqlQuery, variables })
  });

  if (!gqlRes.ok) {
    const errorText = await gqlRes.text();
    console.error('CJ API HTTP Error:', errorText);
    throw new Error(`CJ API Error ${gqlRes.status}: ${errorText}`);
  }

  const gqlData = await gqlRes.json();
  if (gqlData.errors) {
    console.error('CJ GraphQL Errors:', gqlData.errors);
    throw new Error(`CJ GraphQL Error: ${JSON.stringify(gqlData.errors)}`);
  }
  return gqlData;
}

function buildShoppingProductsQuery(includePartnerIds) {
  const varDecl = includePartnerIds
    ? ", $partnerIds: [ID!]"
    : "";
  const argUse = includePartnerIds
    ? ", partnerIds: $partnerIds"
    : "";
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
          link
        }
      }
    }
  `;
}

function corsHeaders(env) {
  const allow = env.ALLOW_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
  };
}

function json(body, env, status = 200) {
  const headers = { ...corsHeaders(env), 'Content-Type': 'application/json' };
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}
