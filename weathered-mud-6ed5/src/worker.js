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
  // Check for all required GraphQL API credentials
  if (!env.CJ_DEV_KEY || !env.CJ_COMPANY_ID) {
    const missing = [
      !env.CJ_DEV_KEY && "CJ_DEV_KEY",
      !env.CJ_COMPANY_ID && "CJ_COMPANY_ID"
    ].filter(Boolean).join(', ');
    return json({ error: `Missing required credentials: ${missing}` }, env, 500);
  }

  // Build GraphQL Query Parameters
  const advertiserIds = url.searchParams.get('advertiserIds');
  const keywords = url.searchParams.get('q') || 'fragrance';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const page = parseInt(url.searchParams.get('page') || '1');
  const offset = (page - 1) * limit;

  // Convert keywords string to array for GraphQL
  const keywordsArray = keywords.split(/\s+/).filter(k => k.trim().length > 0);

  // Build advertiser filter
  let advertiserFilter = '';
  if (advertiserIds && advertiserIds.trim() !== '') {
    const advertiserArray = advertiserIds.split(',').map(id => `"${id.trim()}"`).join(', ');
    advertiserFilter = `, advertiserIds: [${advertiserArray}]`;
  }

  const query = `
    query GetProducts($companyId: ID!, $keywords: [String!], $limit: Int!, $offset: Int!) {
      products(
        companyId: $companyId
        keywords: $keywords
        limit: $limit
        offset: $offset
        ${advertiserFilter}
      ) {
        totalCount
        resultList {
          id
          title
          description
          price {
            amount
            currency
          }
          imageLink
          advertiserId
          catalogId
        }
      }
    }
  `;

  try {
    const cjRes = await fetch('https://ads.api.cj.com/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CJ_DEV_KEY}`,
        'Accept': 'application/json, */*',
        'Content-Type': 'application/json',
        'User-Agent': 'Fragrance-Collect/1.0'
      },
      body: JSON.stringify({
        query,
        variables: {
          companyId: env.CJ_COMPANY_ID,
          keywords: keywordsArray,
          limit: limit,
          offset: offset
        }
      })
    });

    if (!cjRes.ok) {
      const errorText = await cjRes.text();
      return json({ error: 'CJ GraphQL API request failed (products)', status: cjRes.status, details: errorText }, env, cjRes.status);
    }
    
    const data = await cjRes.json();
    
    if (data.errors) {
      return json({ error: 'CJ GraphQL API returned errors', details: data.errors[0]?.message || 'Unknown error' }, env, 400);
    }
    
    // Extract products from GraphQL response
    const productList = data.data?.products?.resultList || [];
    
    // Debug logging
    console.log('Raw CJ GraphQL API response:', JSON.stringify(data, null, 2));
    console.log('Product count:', productList.length);
    
    const products = productList.map((p, index) => {
      // Log each product to see what fields are available
      console.log(`Product ${index + 1}:`, {
        id: p.id,
        title: p.title,
        hasImage: !!p.imageLink,
        hasPrice: !!p.price?.amount,
        advertiserId: p.advertiserId
      });
      
      // Construct affiliate link manually using CJ pattern
      const cjLink = constructCJAffiliateLink(p.id, p.advertiserId, env.CJ_WEBSITE_ID);
      
      return {
        id: p.id || `${p.advertiserId}-${p.catalogId || Date.now()}`,
        name: p.title || 'Unknown Product',
        brand: p.advertiserId || 'Unknown',
        price: p.price?.amount ? parseFloat(p.price.amount) : 0,
        rating: 0, // Rating not available in GraphQL API
        image: p.imageLink || null,
        description: p.description || '',
        cjLink: cjLink,
        advertiser: p.advertiserId || 'Unknown',
        shippingCost: null, // Shipping cost not available in GraphQL API
        currency: p.price?.currency || 'USD',
        // Add debug info
        debug: {
          hasImage: !!p.imageLink,
          hasPrice: !!p.price?.amount,
          hasLink: !!cjLink,
          advertiserId: p.advertiserId,
          catalogId: p.catalogId,
          constructedLink: cjLink
        }
      };
    });

    // Apply advertiser filtering if specified
    let filteredProducts = products;
    if (advertiserIds && advertiserIds.trim() !== '') {
      const advertiserArray = advertiserIds.split(',').map(id => id.trim());
      filteredProducts = products.filter(p => 
        p.advertiserId && advertiserArray.includes(p.advertiserId)
      );
      console.log(`Advertiser filtered: ${products.length} total, ${filteredProducts.length} after advertiser filter`);
    }

    // Filter out products without affiliate links
    const productsWithLinks = filteredProducts.filter(p => p.cjLink && p.cjLink.trim() !== '');
    
    console.log(`Final filtered products: ${filteredProducts.length} total, ${productsWithLinks.length} with affiliate links`);

    return json({ 
      products: productsWithLinks, 
      total: productsWithLinks.length,
      originalTotal: productList.length,
      debug: {
        totalProducts: productList.length,
        productsWithLinks: productsWithLinks.length,
        productsWithoutLinks: products.length - productsWithLinks.length,
        filteredOut: products.length - productsWithLinks.length,
        note: "Using GraphQL API with manually constructed affiliate links - no shipping data available",
        rawFirstProduct: productList.length > 0 ? productList[0] : null
      }
    }, env);

  } catch (error) {
    return json({ error: 'Failed to fetch from CJ GraphQL API', details: error.message }, env, 500);
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