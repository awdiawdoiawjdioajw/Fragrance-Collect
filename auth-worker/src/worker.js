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
    if (url.pathname === '/verify' && request.method === 'POST') {
      return handleVerificationRequest(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleVerificationRequest(request, env) {
  try {
    const { token } = await request.json();
    const CLIENT_ID = env.GOOGLE_CLIENT_ID;

    if (!token) {
      return jsonResponse({ error: 'Token is required' }, 400);
    }

    // 1. Decode JWT to get header and payload
    const { header, payload, signature } = decodeJwt(token);

    // 2. Get the appropriate Google public key to verify the token's signature
    const publicKey = await getGooglePublicKey(header.kid);
    if (!publicKey) {
      return jsonResponse({ error: 'Could not retrieve public key for verification' }, 500);
    }
    
    // 3. Verify the token's signature
    const isValidSignature = await verifySignature(publicKey, signature, token);
    if (!isValidSignature) {
      return jsonResponse({ error: 'Invalid token signature' }, 401);
    }

    // 4. Verify the token's claims
    verifyClaims(payload, CLIENT_ID);

    const user = {
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    };

    return jsonResponse({ success: true, user }, 200);

  } catch (error) {
    return jsonResponse({ error: 'Token verification failed', details: error.message }, 401);
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


// --- Utility Functions ---

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function handleOptions(request) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    return new Response(null, { headers: corsHeaders });
  } else {
    return new Response(null, { headers: { Allow: 'POST, OPTIONS' } });
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
