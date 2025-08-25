export default {
  async fetch(req, env) {
    // Standard CORS preflight handling
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    const segs = path.split('/').filter(Boolean);
    const endpoint = segs[segs.length - 1] || '';

    // Main request router
    try {
      switch (endpoint) {
        case '':
          return json({ 
            ok: true, 
            endpoints: ['/health', '/products', '/feeds', '/trending', '/analytics'],
            version: '2.0.0',
            features: ['multi-store-search', 'revenue-optimization', 'smart-caching']
          }, env);
        
        case 'health':
          return await handleHealthRequest(env);

        case 'feeds':
          return await handleFeedsRequest(env);

        case 'products':
          return await handleProductsRequest(req, url, env);

        case 'trending':
          return await handleTrendingRequest(env);

        case 'analytics':
          return await handleAnalyticsRequest(req, env);

        case 'test-cj':
          return await handleTestCJRequest(env);

        case 'test-graphql':
          return await handleTestGraphQLRequest(env);

        default:
          return json({ error: 'Not found', path }, env, 404);
      }
    } catch (error) {
      console.error('Worker error:', error);
      return json({ error: 'An internal worker error occurred', details: error.message }, env, 500);
    }
  }
};

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

// Trending keywords cache
let trendingKeywordsCache = {
  data: [],
  timestamp: 0,
  duration: REVENUE_CONFIG.TRENDING_CACHE_DURATION * 1000
};

/**
 * Enhanced products endpoint with revenue-optimized multi-store search
 */
async function handleProductsRequest(req, url, env) {
  const { searchParams } = new URL(url);
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const offset = (page - 1) * limit;
  const lowPrice = parseFloat(searchParams.get('lowPrice')) || null;
  const highPrice = parseFloat(searchParams.get('highPrice')) || null;
  const partnerId = searchParams.get('partnerId') || null;
  const includeTikTok = searchParams.get('includeTikTok') !== 'false';
  const sortBy = searchParams.get('sortBy') || 'price_low'; // revenue, relevance, price, trending
  const brandFilter = searchParams.get('brand') || null;

  // Smart cache key generation
  const cacheKey = generateCacheKey({
    query, limit, page, lowPrice, highPrice, partnerId, 
    includeTikTok, sortBy, brandFilter
  });
  
  // Try to get from cache first
  const cache = caches.default;
  let response = await cache.match(new Request(`https://cache/${cacheKey}`));
  
  if (response) {
    console.log('🚀 Cache hit for:', cacheKey);
    return response;
  }

  console.log('💸 Revenue-optimized search initiated:', { query, limit, page, sortBy });

  try {
    // Step 1: Search CJ Store (Primary - Higher Commission)
    // Fetch a larger pool of products to allow for proper sorting and pagination.
    const cjProducts = await searchCJStore(query, 250, 0, lowPrice, highPrice, partnerId, env);
    console.log(`✅ CJ Store: Found ${cjProducts.length} products`);
    
    // Step 2: Search TikTok Shop (Secondary - Trending Products)
    let tiktokProducts = [];
    if (includeTikTok && !partnerId) {
      tiktokProducts = await searchTikTokStore(query, 100, 0, lowPrice, highPrice, env);
      console.log(`🎵 TikTok Shop: Found ${tiktokProducts.length} products`);
    }

    // Step 3: Smart Fallback - If CJ has no results, prioritize TikTok
    if (cjProducts.length === 0 && tiktokProducts.length > 0) {
      console.log('🔄 Smart fallback: Using TikTok results as primary');
      tiktokProducts = await searchTikTokStore(query, 200, 0, lowPrice, highPrice, env);
    }

    // Step 4: Combine and optimize for revenue
    const allProducts = [...cjProducts, ...tiktokProducts];
    const deduplicatedProducts = deduplicateProducts(allProducts);
    
    // Step 5: Apply revenue-optimized sorting and filtering
    const optimizedProducts = optimizeForRevenue(deduplicatedProducts, query, sortBy, brandFilter);
    
    // Step 6: Format results and filter out any invalid products
    const products = optimizedProducts.map(p => formatProductForRevenue(p, query)).filter(Boolean);

    // Step 7: Get total count and apply pagination
    const total = products.length;
    const paginatedProducts = products.slice(offset, offset + limit);

    // Step 8: Calculate revenue metrics
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
    
    // Dynamic caching based on search type
    const cacheDuration = determineCacheDuration(query, sortBy);
    const cacheResponse = response.clone();
    cacheResponse.headers.set('Cache-Control', `s-maxage=${cacheDuration}`);
    await cache.put(new Request(`https://cache/${cacheKey}`), cacheResponse);

    console.log(`💰 Revenue-optimized search complete: ${products.length} products, ${cacheDuration}s cache`);
    return response;

  } catch (error) {
    console.error('❌ Multi-store search error:', error);
    return json({ error: 'Failed to fetch products from stores', details: error.message }, env, 500);
  }
}

/**
 * Revenue-optimized CJ Store search
 */
async function searchCJStore(query, limit, offset, lowPrice, highPrice, partnerId, env) {
  const gqlQuery = buildShoppingProductsQuery(!!partnerId);

  if (query) {
    // Revenue-optimized search with expanded limit
    const gqlVariables = {
      companyId: env.CJ_COMPANY_ID,
      keywords: query.split(/\s+/).filter(k => k.length > 0),
      limit: Math.min(limit * 2, 400), // Get more for better revenue optimization
      offset,
      websiteId: env.CJ_WEBSITE_ID,
      lowPrice,
      highPrice,
      partnerIds: partnerId ? [partnerId] : null
    };
    
    const gqlData = await fetchCJProducts(gqlQuery, gqlVariables, env);
    return gqlData.data?.shoppingProducts?.resultList || [];
  } else {
    // Multi-query with revenue-optimized keywords
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

/**
 * Revenue-optimized TikTok Store search
 */
async function searchTikTokStore(query, limit, offset, lowPrice, highPrice, env) {
  try {
    const gqlQuery = buildShoppingProductsQuery(true);

    if (query) {
      // Trending-focused search for TikTok
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
      // TikTok trending keywords
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
    console.error('TikTok Store search error:', error);
    return []; // Return empty array if TikTok search fails
  }
}

/**
 * Revenue-optimized product optimization
 */
function optimizeForRevenue(products, query, sortBy, brandFilter) {
  // Apply filters
  let filtered = products.filter(p => {
    if (brandFilter && p.brand?.toLowerCase() !== brandFilter.toLowerCase()) return false;
    return true;
  });

  // Calculate revenue scores
  filtered = filtered.map(p => ({
    ...p,
    revenueScore: calculateRevenueScore(p, query),
    commissionRate: getCommissionRate(p),
    trendingScore: calculateTrendingScore(p)
  }));

  // Sort by revenue optimization strategy
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

/**
 * Calculate revenue score for products
 */
function calculateRevenueScore(product, query) {
  let score = 0;
  
  // Base commission rate
  const commissionRate = getCommissionRate(product);
  score += commissionRate * 100;
  
  // Price optimization (prefer $50-$300 range)
  const price = parseFloat(product.price?.amount || 0);
  if (price >= REVENUE_CONFIG.OPTIMAL_PRICE_RANGE.min && price <= REVENUE_CONFIG.OPTIMAL_PRICE_RANGE.max) {
    score += 50;
  }
  
  // Brand category weighting
  const brandCategory = getBrandCategory(product);
  const categoryWeight = COMMISSION_RATES[brandCategory]?.weight || COMMISSION_RATES.default.weight;
  score *= categoryWeight;
  
  // Query relevance
  if (query) {
    const relevance = calculateRelevance(product, query);
    score += relevance * 0.3;
  }
  
  // Store weighting (CJ gets higher weight)
  if (product.advertiserName?.includes('TikTok')) {
    score *= REVENUE_CONFIG.TIKTOK_WEIGHT;
  } else {
    score *= REVENUE_CONFIG.CJ_WEIGHT;
  }
  
  return score;
}

/**
 * Get commission rate for product
 */
function getCommissionRate(product) {
  if (!product.linkCode?.clickUrl) {
    return 0;
  }
  const brandCategory = getBrandCategory(product);
  return COMMISSION_RATES[brandCategory]?.rate || COMMISSION_RATES.default.rate;
}

/**
 * Determine brand category for commission calculation
 */
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

/**
 * Calculate trending score
 */
function calculateTrendingScore(product) {
  let score = 0;
  const title = product.title?.toLowerCase() || '';
  
  // Trending keywords
  if (title.includes('viral') || title.includes('trending')) score += 30;
  if (title.includes('tiktok') || title.includes('social media')) score += 25;
  if (title.includes('limited edition')) score += 20;
  if (title.includes('new') || title.includes('2024')) score += 15;
  
  return score;
}

/**
 * Format product with revenue information
 */
function formatProductForRevenue(p, query) {
  const cjLink = p.linkCode?.clickUrl || p.link;
  
  if (!cjLink || !p.imageLink) {
    return null;
  }
  
  // Filter out non-USD products
  const currency = p.price?.currency || 'USD';
  if (currency.toUpperCase() !== 'USD') {
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

/**
 * Generate trending badges
 */
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

/**
 * Calculate search relevance
 */
function calculateRelevance(product, query) {
  if (!query) return 0;
  
  const queryLower = query.toLowerCase();
  const titleLower = product.title?.toLowerCase() || '';
  const brandLower = product.brand?.toLowerCase() || '';
  
  let score = 0;
  
  // Exact matches get highest score
  if (titleLower.includes(queryLower)) score += 100;
  if (brandLower.includes(queryLower)) score += 80;
  
  // Partial word matches
  const queryWords = queryLower.split(/\s+/);
  queryWords.forEach(word => {
    if (titleLower.includes(word)) score += 20;
    if (brandLower.includes(word)) score += 15;
  });
  
  return score;
}

/**
 * Calculate revenue metrics
 */
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

/**
 * Generate smart cache key
 */
function generateCacheKey(params) {
  const { query, limit, page, lowPrice, highPrice, partnerId, includeTikTok, sortBy, brandFilter } = params;
  return `products:${query}:${limit}:${page}:${lowPrice}:${highPrice}:${partnerId}:${includeTikTok}:${sortBy}:${brandFilter}`;
}

/**
 * Determine cache duration based on search type
 */
function determineCacheDuration(query, sortBy) {
  if (!query) return REVENUE_CONFIG.GENERIC_CACHE_DURATION;
  
  const queryLower = query.toLowerCase();
  
  // Trending/hot searches
  if (queryLower.includes('viral') || queryLower.includes('trending') || queryLower.includes('new')) {
    return REVENUE_CONFIG.TRENDING_CACHE_DURATION;
  }
  
  // Brand searches
  if (queryLower.includes('chanel') || queryLower.includes('dior') || queryLower.includes('gucci')) {
    return REVENUE_CONFIG.BRAND_CACHE_DURATION;
  }
  
  // Seasonal searches
  if (queryLower.includes('christmas') || queryLower.includes('holiday') || queryLower.includes('summer')) {
    return REVENUE_CONFIG.SEASONAL_CACHE_DURATION;
  }
  
  // Hot searches
  if (queryLower.includes('perfume') || queryLower.includes('fragrance')) {
    return REVENUE_CONFIG.HOT_SEARCH_CACHE_DURATION;
  }
  
  return REVENUE_CONFIG.GENERIC_CACHE_DURATION;
}

/**
 * Deduplicate products across stores
 */
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

/**
 * Handles requests to the /feeds endpoint.
 * Fetches advertiser and feed info from CJ's GraphQL API.
 */
async function handleFeedsRequest(env) {
  // Check for the required GraphQL credentials
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

/**
 * Helper function to execute a GraphQL query against the CJ API.
 * Throws an error if the request fails or returns GraphQL errors.
 */
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

/**
 * Build CJ GraphQL shoppingProducts query, optionally including $partnerIds
 * Some CJ schemas reject unused variables, so only declare when used
 */
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

/**
 * Handles requests to the /test-cj endpoint.
 * This endpoint is for debugging and will return environment info and a simple test.
 */
async function handleTestCJRequest(env) {
  // Check for the required GraphQL credentials
  if (!env.CJ_DEV_KEY || !env.CJ_COMPANY_ID || !env.CJ_WEBSITE_ID) {
    const missing = [
      !env.CJ_DEV_KEY && "CJ_DEV_KEY",
      !env.CJ_COMPANY_ID && "CJ_COMPANY_ID",
      !env.CJ_WEBSITE_ID && "CJ_WEBSITE_ID"
    ].filter(Boolean).join(', ');
    return json({ error: `Missing required credentials: ${missing}` }, env, 500);
  }

  // Simple test query to check API connectivity
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

/**
 * Handles requests to the /test-graphql endpoint.
 * This endpoint is for debugging and will return the raw GraphQL response
 * for a simple query to see what fields are actually available.
 */
async function handleTestGraphQLRequest(env) {
  // Check for the required GraphQL credentials
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

/**
 * Handles health check requests
 */
async function handleHealthRequest(env) {
  return json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['multi-store-search', 'revenue-optimization', 'smart-caching']
  }, env);
}

/**
 * Handles trending requests
 */
async function handleTrendingRequest(env) {
  return json({ 
    trending: ['luxury perfume', 'designer fragrance', 'viral perfume', 'limited edition'],
    timestamp: new Date().toISOString()
  }, env);
}

/**
 * Handles analytics requests
 */
async function handleAnalyticsRequest(req, env) {
  return json({ 
    message: 'Analytics endpoint - coming soon',
    timestamp: new Date().toISOString()
  }, env);
}




// --- Helper Functions ---

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