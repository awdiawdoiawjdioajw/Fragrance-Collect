import http from 'http';
import { URL } from 'url';

const CJ_DEV_KEY = process.env.CJ_DEV_KEY;
const CJ_WEBSITE_ID = process.env.CJ_WEBSITE_ID;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok' }));
    }

    if (url.pathname === '/products') {
      if (!CJ_DEV_KEY || !CJ_WEBSITE_ID) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing CJ credentials' }));
      }

      const search = url.searchParams.get('q') || 'perfume fragrance cologne';
      const perPage = url.searchParams.get('limit') || '50';
      const page = url.searchParams.get('page') || '1';

      const qs = new URLSearchParams({
        'website-id': CJ_WEBSITE_ID,
        'advertiser-ids': 'joined',
        keywords: search,
        'records-per-page': perPage,
        'page-number': page
      });

      const apiUrl = `https://product-search.api.cj.com/v2/product-search?${qs.toString()}&format=json`;

      const cjRes = await fetch(apiUrl, {
        headers: {
          Authorization: CJ_DEV_KEY,
          Accept: 'application/json'
        }
      });

      if (!cjRes.ok) {
        const text = await cjRes.text();
        res.writeHead(cjRes.status, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'CJ API error', details: text }));
      }

      const data = await cjRes.json();
      const products = (data.products || []).map((p) => ({
        id: p.sku || p.ad_id || p.productId,
        name: p.name,
        brand: p.manufacturer || p.advertiserName,
        price: Number(p.price) || 0,
        image: p.imageUrl,
        description: p.description || '',
        cjLink: p.buyUrl,
        advertiser: p.advertiserName,
        rating: Number(p.rating) || 0,
        // Shipping mapping: prefer explicit fields if present; fallback heuristics
        shippingCost: normalizeShipping(p.shippingCost, p.shipping, p.buyUrl)
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ products }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server error', details: e.message }));
  }
});

function normalizeShipping(cost, shippingField, url) {
  // Attempt to parse to number if present
  if (typeof cost === 'string' && cost.trim().toLowerCase() === 'free') return 0;
  if (typeof cost === 'number') return cost;
  if (shippingField && typeof shippingField === 'string') {
    if (shippingField.toLowerCase().includes('free')) return 0;
    const match = shippingField.match(/\$([0-9]+(\.[0-9]{1,2})?)/);
    if (match) return Number(match[1]);
  }
  // As a last resort, unknown
  return null; // null = unknown
}

server.listen(3000, () => {
  console.log('API listening on :3000');
});


