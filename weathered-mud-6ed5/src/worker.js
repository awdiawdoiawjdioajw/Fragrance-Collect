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
          return json({ ok: true, endpoints: ['/health', '/products', '/feeds'] }, env);
        
        case 'health':
          return json({ status: 'ok' }, env);

        case 'feeds':
          return await handleFeedsRequest(env);

        case 'products':
          return await handleProductsRequest(url, env);

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
    query productFeeds($companyId: Int!) {
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
    companyId: parseInt(env.CJ_COMPANY_ID)
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
 * Handles requests to the /products endpoint using the CJ GraphQL API.
 * Since the API doesn't provide affiliate links directly, we construct them manually.
 */
async function handleProductsRequest(url, env) {
  // Check for the required credentials
  if (!env.CJ_DEV_KEY || !env.CJ_WEBSITE_ID) {
    return json({ error: 'Missing required credentials: CJ_DEV_KEY, CJ_WEBSITE_ID' }, env, 500);
  }

  const searchParams = url.searchParams;
  const query = searchParams.get('q') || 'fragrance';
  const limit = parseInt(searchParams.get('limit') || '50');
  const advertiserIds = searchParams.get('advertiserIds') || '';

  console.log(`Products request: query="${query}", limit=${limit}, advertiserIds="${advertiserIds}"`);

  try {
    // Use the link-search API to get real affiliate links
    const linkSearchParams = new URLSearchParams({
      'website-id': env.CJ_WEBSITE_ID,
      'keywords': query,
      'records-per-page': limit.toString(),
      'page-number': '1'
    });

    if (advertiserIds && advertiserIds.trim() !== '') {
      linkSearchParams.set('advertiser-ids', advertiserIds);
    }

    const linkSearchUrl = `https://link-search.api.cj.com/v2/link-search?${linkSearchParams}`;
    console.log('Link search URL:', linkSearchUrl);

    const linkRes = await fetch(linkSearchUrl, {
      headers: {
        'Authorization': `Bearer ${env.CJ_DEV_KEY}`,
        'Accept': 'application/json, */*'
      }
    });

    if (!linkRes.ok) {
      const errorText = await linkRes.text();
      console.error('Link search API error:', linkRes.status, errorText);
      return json({ error: 'CJ link-search API request failed', status: linkRes.status, details: errorText }, env, linkRes.status);
    }

    const linkData = await linkRes.json();
    console.log('Link search response structure:', Object.keys(linkData));

    if (linkData.errorMessage) {
      console.error('Link search error:', linkData.errorMessage);
      return json({ error: 'CJ link-search API error', details: linkData.errorMessage }, env, 500);
    }

    const linkList = linkData.links || [];
    console.log(`Found ${linkList.length} affiliate links from link-search API`);

    // Filter out promotional/banner links, keep only product links
    const productLinks = linkList.filter(link => {
      const name = link.linkName?.toLowerCase() || '';
      return !name.includes('banner') && 
             !name.includes('logo') && 
             !name.includes('promotional') &&
             link.clickUrl && 
             link.clickUrl.trim() !== '';
    });

    console.log(`Filtered to ${productLinks.length} product links`);

    // Map the link data to our product format
    const products = productLinks.map((link, index) => {
      console.log(`Product link ${index + 1}:`, {
        linkId: link.linkId,
        linkName: link.linkName,
        hasImage: !!link.imageUrl,
        hasClickUrl: !!link.clickUrl,
        advertiserName: link.advertiserName
      });

      return {
        id: link.linkId || `link_${Date.now()}_${index}`,
        name: link.linkName || 'Unknown Product',
        brand: link.advertiserName || 'Unknown Brand',
        price: 0, // Price not available in link-search API
        rating: 0, // Rating not available in link-search API
        image: link.imageUrl || null,
        description: link.description || '',
        cjLink: link.clickUrl || '', // Use the real affiliate link
        advertiser: link.advertiserName || 'Unknown',
        shippingCost: null, // Shipping cost not available in link-search API
        currency: 'USD',
        // Add debug info
        debug: {
          hasImage: !!link.imageUrl,
          hasPrice: false,
          hasLink: !!link.clickUrl,
          advertiserId: link.advertiserId,
          linkId: link.linkId,
          realAffiliateLink: link.clickUrl
        }
      };
    });

    // Apply advertiser filtering if specified
    let filteredProducts = products;
    if (advertiserIds && advertiserIds.trim() !== '') {
      const advertiserArray = advertiserIds.split(',').map(id => id.trim());
      filteredProducts = products.filter(p => 
        p.advertiser && advertiserArray.includes(p.advertiser)
      );
      console.log(`Advertiser filtered: ${products.length} total, ${filteredProducts.length} after advertiser filter`);
    }

    // Filter out products without affiliate links
    const productsWithLinks = filteredProducts.filter(p => p.cjLink && p.cjLink.trim() !== '');
    
    console.log(`Final filtered products: ${filteredProducts.length} total, ${productsWithLinks.length} with affiliate links`);

    return json({ 
      products: productsWithLinks, 
      total: productsWithLinks.length,
      originalTotal: linkList.length,
      debug: {
        totalProducts: linkList.length,
        productsWithLinks: productsWithLinks.length,
        productsWithoutLinks: products.length - productsWithLinks.length,
        filteredOut: products.length - productsWithLinks.length,
        note: "Using link-search API for real affiliate links - limited product data available",
        rawFirstProduct: productLinks.length > 0 ? productLinks[0] : null
      }
    }, env);

  } catch (error) {
    return json({ error: 'Failed to fetch from CJ link-search API', details: error.message }, env, 500);
  }
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
    query testQuery($companyId: Int!) {
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
    companyId: parseInt(env.CJ_COMPANY_ID)
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
 * Constructs an affiliate link for a CJ product using the standard pattern.
 * @param {string} productId - The CJ product ID.
 * @param {string} advertiserId - The CJ advertiser ID.
 * @param {string} websiteId - The CJ website ID.
 * @returns {string} - The constructed affiliate link.
 */
function constructCJAffiliateLink(productId, advertiserId, websiteId) {
  if (!productId || !advertiserId || !websiteId) {
    return '';
  }
  return `https://www.cj.com/click/click.asp?site_id=${websiteId}&link_id=${productId}&advertiser_id=${advertiserId}`;
}

/**
 * A simple XML parser for the CJ link-search API response.
 * It extracts the image URL from the link-code-html.
 * @param {string} xmlString - The XML string from the API.
 * @returns {object} - A JSON object representing the parsed data.
 */
function parseCJXML(xmlString) {
  const links = [];
  // Use a regex to capture the content inside each <link> tag
  const linkRegex = /<link>([\s\S]*?)<\/link>/g;
  let match;
  const errorMatch = xmlString.match(/<error-message>(.*?)<\/error-message>/s);
  if (errorMatch) {
    return { errorMessage: errorMatch[1] };
  }
  while ((match = linkRegex.exec(xmlString)) !== null) {
    const linkContent = match[1];
    const linkObj = {};
    // Regex to find all simple <tag>value</tag> pairs
    const tagRegex = /<([a-zA-Z0-9-]+)>([\s\S]*?)<\/\1>/g;
    let propMatch;
    while((propMatch = tagRegex.exec(linkContent)) !== null) {
      // Convert kebab-case to camelCase (e.g., advertiser-id -> advertiserId)
      const key = propMatch[1].replace(/-(\w)/g, (_, c) => c.toUpperCase());
      // Clean up CDATA sections
      linkObj[key] = propMatch[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    }
    // Specifically search for an image URL within the linkCodeHtml
    const imgMatch = linkObj.linkCodeHtml?.match(/<img src="([^"]+)"/);
    linkObj.imageUrl = imgMatch ? imgMatch[1] : null;
    links.push(linkObj);
  }
  return { links };
}

// --- Helper Functions ---

function corsHeaders(env) {
  const allow = env.ALLOW_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(body, env, status = 200) {
  const headers = { ...corsHeaders(env), 'Content-Type': 'application/json' };
  return new Response(JSON.stringify(body, null, 2), { status, headers });
}