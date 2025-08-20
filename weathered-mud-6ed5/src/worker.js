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
          return await handleProductsRequest(req, url, env);

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
async function handleProductsRequest(req, url, env) {
  // Check for all required credentials
  if (!env.CJ_DEV_KEY || !env.CJ_COMPANY_ID || !env.CJ_WEBSITE_ID) {
    return json({ error: 'Missing required credentials: CJ_DEV_KEY, CJ_COMPANY_ID, CJ_WEBSITE_ID' }, env, 500);
  }

  const searchParams = url.searchParams;
  const query = searchParams.get('q') || 'fragrance';
  const limit = parseInt(searchParams.get('limit') || '50');
  const page = parseInt(searchParams.get('page') || '1');
  const offset = (page - 1) * limit;

  console.log(`Products request: query="${query}", limit=${limit}, page=${page}, offset=${offset}`);

  // Implement caching
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), req);
  let response = await cache.match(cacheKey);

  if (response) {
    console.log('Cache hit');
    return response;
  }

  console.log('Cache miss');

  try {
    // Step 1: Get rich product data from GraphQL API
    const gqlQuery = `
      query products($companyId: ID!, $keywords: [String!], $limit: Int!, $offset: Int!, $websiteId: ID!) {
        products(companyId: $companyId, keywords: $keywords, limit: $limit, offset: $offset) {
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
            advertiserName
            linkCode(pid: $websiteId) {
              clickUrl
            }
          }
        }
      }
    `;

    const gqlVariables = {
      companyId: env.CJ_COMPANY_ID,
      keywords: query.split(/\s+/).filter(k => k.length > 0),
      limit: limit, // Use the limit from the request
      offset: offset,
      websiteId: env.CJ_WEBSITE_ID
    };

    const gqlRes = await fetch('https://ads.api.cj.com/query', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.CJ_DEV_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json, */*' },
      body: JSON.stringify({ query: gqlQuery, variables: gqlVariables })
    });

    if (!gqlRes.ok) {
      const errorText = await gqlRes.text();
      return json({ error: 'CJ GraphQL API request failed', status: gqlRes.status, details: errorText }, env, gqlRes.status);
    }

    const gqlData = await gqlRes.json();
    if (gqlData.errors) {
      return json({ error: 'CJ GraphQL API errors', details: gqlData.errors }, env, 500);
    }

    const productList = gqlData.data?.products?.resultList || [];
    const totalCount = gqlData.data?.products?.totalCount || 0;
    console.log(`Found ${productList.length} products from GraphQL API`);

    // Step 2: Process the product list to extract the correct link
    const products = productList
      .map(p => {
        const cjLink = p.linkCode?.clickUrl;
        if (!cjLink) {
          return null; // Discard product if no monetizable link is found
        }
        return {
          id: p.id,
          name: p.title,
          brand: p.advertiserName,
          price: parseFloat(p.price?.amount || 0),
          image: p.imageLink,
          description: p.description,
          cjLink: cjLink, // Use the real, monetizable link from GraphQL
          advertiser: p.advertiserName,
          currency: p.price?.currency || 'USD',
          debug: {
            source: 'GraphQL with linkCode'
          }
        };
      })
      .filter(Boolean) // Remove null entries
      .slice(0, limit); // Apply limit after filtering

    console.log(`Returning ${products.length} processed products`);

    const jsonResponse = {
      products: products,
      total: totalCount,
      page: page,
      limit: limit,
      originalTotal: productList.length,
      debug: {
        note: "Using GraphQL with linkCode to get direct affiliate links.",
        rawFirstProduct: productList.length > 0 ? productList[0] : null
      }
    };

    response = json(jsonResponse, env);
    response.headers.set('Cache-Control', 's-maxage=3600'); // Cache for 1 hour
    await cache.put(cacheKey, response.clone());

    return response;

  } catch (error) {
    console.error('Product fetch error:', error);
    return json({ error: 'Failed to fetch products', details: error.message }, env, 500);
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