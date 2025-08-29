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

    if (url.pathname === '/signup/email' && request.method === 'POST') {
      return handleEmailSignup(request, env);
    }

    if (url.pathname === '/login/email' && request.method === 'POST') {
      return handleEmailLogin(request, env);
    }

    const headers = getSecurityHeaders(request.headers.get('Origin'));
    return new Response('Not Found', { status: 404, headers });
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

    // 4. Create a secure session
    const sessionId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await env.DB.prepare(
        `INSERT INTO user_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
    ).bind(sessionId, id, token, expiresAt.toISOString()).run();

    // 5. Set the session token in a secure, HttpOnly cookie
    headers['Set-Cookie'] = `session_token=${token}; Expires=${expiresAt.toUTCString()}; Path=/; HttpOnly; Secure; SameSite=Strict`;
    
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
    return new Response(null, {
        status: 302,
        headers: {
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
        headers['Set-Cookie'] = `session_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure; SameSite=Strict`;

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
        const token = cookies.session_token;

        if (!token) {
            return jsonResponse({ error: 'Not authenticated' }, 401, headers);
        }

        const session = await env.DB.prepare(
            `SELECT s.expires_at, u.id, u.email, u.name, u.picture 
             FROM user_sessions s JOIN users u ON s.user_id = u.id 
             WHERE s.token = ?`
        ).bind(token).first();

        if (!session || new Date(session.expires_at) < new Date()) {
            // If session is expired or invalid, clear the cookie
            headers['Set-Cookie'] = `session_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure; SameSite=Strict`;
            return jsonResponse({ error: 'Invalid or expired session' }, 401, headers);
        }

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
 * Handles user sign-up with email and password.
 */
async function handleEmailSignup(request, env) {
    const origin = request.headers.get('Origin');
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

        await env.DB.prepare(
            `INSERT INTO user_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
        ).bind(sessionId, userId, token, expiresAt.toISOString()).run();

        headers['Set-Cookie'] = `session_token=${token}; Expires=${expiresAt.toUTCString()}; Path=/; HttpOnly; Secure; SameSite=Strict`;

        return jsonResponse({ success: true, user: { id: userId, name, email } }, 201, headers);

    } catch (error) {
        console.error('Error during email signup:', error);
        return jsonResponse({ error: 'Signup failed.', details: error.message }, 500, headers);
    }
}

/**
 * Handles user login with email and password.
 */
async function handleEmailLogin(request, env) {
    const origin = request.headers.get('Origin');
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

        await env.DB.prepare(
            `INSERT INTO user_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`
        ).bind(sessionId, user.id, token, expiresAt.toISOString()).run();

        headers['Set-Cookie'] = `session_token=${token}; Expires=${expiresAt.toUTCString()}; Path=/; HttpOnly; Secure; SameSite=Strict`;
        
        // Redirect the user back to the auth page with success status and user's first name.
        const firstName = user.name.split(' ')[0];
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

    return {
        'Content-Security-Policy': csp,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
    };
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
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    return new Response(null, { headers: getSecurityHeaders(request.headers.get('Origin')) });
  } else {
    return new Response(null, { headers: { Allow: 'GET, POST, OPTIONS' } });
  }
}

function jsonResponse(data, status = 200, headers = {}) {
  const finalHeaders = {
      ...headers,
      'Content-Type': 'application/json'
  };
  return new Response(JSON.stringify(data), { status, headers: finalHeaders });
}
