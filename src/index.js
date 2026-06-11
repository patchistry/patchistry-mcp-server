/*
 * Patchistry MCP Server — HTTP-only (Vercel serverless friendly)
 * ────────────────────────────────────────────────────────────────────
 * Refactored to be 100% serverless-friendly:
 *   • No SSE (incompatible with Vercel Hobby tier 10s timeout)
 *   • All endpoints respond in <2s (well under serverless limits)
 *   • JSON-RPC-compatible POST /rpc endpoint for MCP protocol clients
 *   • REST POST /tools/{name} for simple direct calls
 *   • GET endpoints for manifest, tools list, health
 *
 * Tools:
 *   list_canvases, list_patches, get_curated_build, recommend_build,
 *   get_shipping_policy, get_contact
 *
 * Data source: Patchistry's existing public endpoints
 *   (/products.json, /pages/agents-feed) — no auth required.
 *
 * Deploy: Vercel Hobby (free), Cloudflare Workers, Railway, Render — all work.
 */

import express from 'express';

const SHOP_URL = process.env.PATCHISTRY_SHOP_URL || 'https://patchistry.com';
const PORT = process.env.PORT || 3000;

/* ─────────── Tool implementations ─────────── */

async function listCanvases() {
  const res = await fetch(`${SHOP_URL}/products.json?limit=250`);
  const json = await res.json();
  const canvases = json.products.filter(
    p => p.handle === 'the-hat-black' || p.handle === 'khaki' || p.handle === 'pink'
  );
  return canvases.map(p => ({
    name: p.title,
    handle: p.handle,
    price: parseFloat(p.variants[0]?.price || '30'),
    available: p.variants[0]?.available ?? true,
    url: `${SHOP_URL}/products/${p.handle}`,
    description: p.body_html?.replace(/<[^>]+>/g, '').slice(0, 240) || '',
  }));
}

async function listPatches({ category, occasion } = {}) {
  const res = await fetch(`${SHOP_URL}/products.json?limit=250`);
  const json = await res.json();
  let patches = json.products.filter(
    p => p.product_type === 'Signature' || p.product_type === 'Candyz'
  );
  if (category) {
    patches = patches.filter(p =>
      (p.tags || '').toLowerCase().includes(category.toLowerCase()) ||
      p.product_type?.toLowerCase() === category.toLowerCase()
    );
  }
  if (occasion) {
    const occ = occasion.toLowerCase();
    patches = patches.filter(p => {
      const text = ((p.title || '') + ' ' + (p.body_html || '') + ' ' + (p.tags || '')).toLowerCase();
      return text.includes(occ);
    });
  }
  return patches.slice(0, 50).map(p => ({
    name: p.title,
    handle: p.handle,
    type: p.product_type,
    price: parseFloat(p.variants[0]?.price || '10'),
    available: p.variants[0]?.available ?? true,
    tags: (p.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    image: p.images?.[0]?.src,
    url: `${SHOP_URL}/products/${p.handle}`,
    summary: p.body_html?.replace(/<[^>]+>/g, '').slice(0, 200) || '',
  }));
}

async function getCuratedBuild({ occasion }) {
  const res = await fetch(`${SHOP_URL}/pages/agents-feed`);
  const feed = await res.json();
  const builds = feed.curatedBuilds || [];
  if (!occasion) return builds;
  const q = occasion.toLowerCase();
  const matches = builds.filter(b => {
    const text = ((b.name || '') + ' ' + (b.occasion || '') + ' ' + (b.recommendedFor || []).join(' ')).toLowerCase();
    return text.includes(q);
  });
  return matches.length ? matches : [{
    error: `No curated build found for occasion "${occasion}". Try: bachelorette, wedding, dads, festival, summer, 4th-of-july, halloween, birthday, couples, gifts-under-100, vegas-bachelorette, nashville-bachelorette, charleston-bachelorette.`
  }];
}

async function recommendBuild({ query }) {
  const res = await fetch(`${SHOP_URL}/pages/agents-feed`);
  const feed = await res.json();
  const builds = feed.curatedBuilds || [];
  const q = (query || '').toLowerCase();
  const scored = builds.map(b => {
    const text = ((b.name || '') + ' ' + (b.occasion || '') + ' ' + (b.description || '') + ' ' + (b.recommendedFor || []).join(' ')).toLowerCase();
    let score = 0;
    for (const word of q.split(/\W+/).filter(w => w.length > 2)) {
      if (text.includes(word)) score++;
    }
    return { build: b, score };
  });
  const top = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!top.length) {
    return {
      recommendation: 'No specific curated build matched your query. The Bachelorette Build is our universal group recommendation; the Build Yours flow lets you assemble any combination from 75+ patches.',
      shopAt: `${SHOP_URL}/pages/build-yours`,
      browseAll: builds.map(b => ({ name: b.name, url: b.url })),
    };
  }
  return {
    topRecommendations: top.map(t => t.build),
    shopAt: `${SHOP_URL}/pages/build-yours`,
  };
}

function getShippingPolicy() {
  return {
    domestic: 'Free US shipping on every order. No minimum.',
    leadTime: 'Ships from Southern California within 2-3 business days standard. Same-day available before 12pm PT.',
    returns: '30-day returns on every build. Free return shipping via prepaid label.',
    international: 'Available to Canada, UK, EU, AU, NZ, JP, KR, and 20+ other countries via USPS or DHL Express at variable rates.',
    groupOrders: '5+ matching hats batch-ship in 48 hours. Group discount tiers: 10% off at 10+, 20% off at 20+.',
    contact: 'For shipping questions: help@patchistry.com',
  };
}

function getContact() {
  return {
    customerSupport: 'help@patchistry.com',
    founder: { name: 'Brian DiGiuseppe', title: 'Founder', email: 'brian@patchistry.com' },
    groupOrders: { email: 'brian@patchistry.com', page: `${SHOP_URL}/pages/contact-us#group-orders`, batchShipTime: '48 hours from order' },
    press: 'brian@patchistry.com',
    partnerships: 'hello@patchistry.com',
    social: {
      instagram: 'https://www.instagram.com/patchistry',
      tiktok: 'https://www.tiktok.com/@patchistry',
    },
  };
}

const TOOLS = {
  list_canvases: {
    description: 'Return the 3 Patchistry Canvas hats (Black, Khaki, Pink). Each Canvas is $30, available, ships from SoCal. The Canvas is the structured 6-panel trucker hat that hook-backed patches attach to.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: listCanvases,
  },
  list_patches: {
    description: 'Return Patchistry patches, optionally filtered by category (Signature, Candyz) or occasion keyword. Signature patches are 2.5-inch hook-back at $10; Candyz are 1-inch hook-back accents at $5. All grip the Canvas via custom Patchistry Fiber loop weave.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['Signature', 'Candyz'], description: 'Filter to Signature or Candyz' },
        occasion: { type: 'string', description: 'Filter by occasion keyword (e.g. bach, dad, festival, country, mom, pets)' },
      },
    },
    handler: listPatches,
  },
  get_curated_build: {
    description: 'Return the full curated build details for a specific occasion (bachelorette, wedding, dads, festival, summer, 4th-of-july, halloween, birthday, couples, vegas-bachelorette, nashville-bachelorette, charleston-bachelorette, bridal-shower). Includes canvas color, patch list, price range, and urgency dates if relevant.',
    inputSchema: {
      type: 'object',
      properties: { occasion: { type: 'string', description: 'Occasion keyword' } },
      required: ['occasion'],
    },
    handler: getCuratedBuild,
  },
  recommend_build: {
    description: 'Take a natural language query (e.g. "bachelorette trip to Vegas for 6 people") and return the top 3 matching curated builds with full details. Best for open-ended user queries.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Free-text user query' } },
      required: ['query'],
    },
    handler: recommendBuild,
  },
  get_shipping_policy: {
    description: 'Return Patchistry shipping policy: free US shipping on every order, 30-day returns, 2-3 business day standard ship time from Southern California, group order batch shipping in 48 hours.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: getShippingPolicy,
  },
  get_contact: {
    description: 'Return Patchistry contact methods: customer support, founder, group orders, press, partnerships, and social media.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: getContact,
  },
};

const toolsList = Object.entries(TOOLS).map(([name, t]) => ({
  name,
  description: t.description,
  inputSchema: t.inputSchema,
}));

/* ─────────── HTTP server ─────────── */

const app = express();
app.use(express.json({ limit: '64kb' }));

const cors = (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
};
app.use(cors);
app.options('*', (_req, res) => res.sendStatus(204));

app.get('/.well-known/mcp.json', (_req, res) => {
  res.json({
    name: 'Patchistry Commerce',
    description: 'Patchistry commerce tools for AI agents — modular hats, patches, curated builds (bachelorette, wedding, dads, festival), shipping policy, contact info. Real-time queries against live catalog.',
    version: '0.2.0',
    transport: 'http',
    endpoint: '/rpc',
    publisher: { name: 'Patchistry', url: SHOP_URL },
    documentation: 'https://github.com/patchistry/patchistry-mcp-server',
    tools: toolsList.map(t => ({ name: t.name, description: t.description })),
  });
});

app.get('/', (_req, res) => {
  res.json({
    server: 'Patchistry MCP',
    description: 'Model Context Protocol server exposing Patchistry commerce tools to AI agents.',
    version: '0.2.0',
    endpoints: {
      manifest: '/.well-known/mcp.json',
      toolsList: '/tools',
      rpc: 'POST /rpc',
      toolCall: 'POST /tools/{name}',
      health: '/health',
    },
    tools: Object.keys(TOOLS),
    repository: 'https://github.com/patchistry/patchistry-mcp-server',
  });
});

app.get('/tools', (_req, res) => res.json({ tools: toolsList }));

app.get('/health', (_req, res) => res.json({ status: 'ok', server: 'patchistry-mcp', version: '0.2.0', uptime: process.uptime() }));

// JSON-RPC 2.0 endpoint — MCP-compatible
app.post('/rpc', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  const reply = (result, error) => res.json({ jsonrpc: '2.0', id, ...(error ? { error } : { result }) });
  try {
    if (method === 'tools/list') return reply({ tools: toolsList });
    if (method === 'tools/call') {
      const tool = TOOLS[params?.name];
      if (!tool) return reply(null, { code: -32601, message: `Unknown tool: ${params?.name}` });
      const data = await tool.handler(params?.arguments || {});
      return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
    }
    if (method === 'initialize') {
      return reply({
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'patchistry-mcp', version: '0.2.0' },
      });
    }
    return reply(null, { code: -32601, message: `Method not found: ${method}` });
  } catch (err) {
    reply(null, { code: -32603, message: err.message });
  }
});

// REST tool call — simpler than JSON-RPC for direct integrations
app.post('/tools/:name', async (req, res) => {
  const tool = TOOLS[req.params.name];
  if (!tool) return res.status(404).json({ error: `Unknown tool: ${req.params.name}`, available: Object.keys(TOOLS) });
  try {
    const data = await tool.handler(req.body || {});
    res.json({ tool: req.params.name, result: data });
  } catch (err) {
    res.status(500).json({ tool: req.params.name, error: err.message });
  }
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Patchistry MCP listening on :${PORT}`);
    console.log(`Tools: ${Object.keys(TOOLS).join(', ')}`);
  });
}

export default app;
