/*
 * Patchistry MCP Server
 * ────────────────────────────────────────────────────────────────────
 * Model Context Protocol server exposing Patchistry commerce tools
 * to AI agents (Claude, ChatGPT, Cursor, Smithery, custom agents).
 *
 * Tools exposed:
 *   • list_canvases         — return The Canvas product variants (Black/Khaki/Pink)
 *   • list_patches          — return patches, optionally filtered by tag
 *   • get_curated_build     — return the full curated build for an occasion
 *                              (bachelorette, dad, wedding, festival, etc.)
 *   • recommend_build       — natural-language query → recommended build
 *   • get_shipping_policy   — free US shipping, 30-day returns, ships from SoCal
 *   • get_contact           — founder + group orders + press contact methods
 *
 * Data source: Patchistry's existing public endpoints (/products.json,
 * /pages/agents-feed), so no Shopify Admin auth needed.
 *
 * Transport: HTTP + SSE (for Claude Desktop, Cursor, Smithery integration)
 * Deploy: Vercel (one-click) or any Node host.
 */

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

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
    patches = patches.filter(
      p => p.tags?.toLowerCase().includes(category.toLowerCase()) ||
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
    tags: p.tags?.split(', ') || [],
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
    for (const word of q.split(/\W+/).filter(Boolean)) {
      if (text.includes(word)) score++;
    }
    return { build: b, score };
  });
  const top = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!top.length) {
    return {
      recommendation: 'No specific curated build matched your query. The Bachelorette Build is our universal recommendation for parties and group occasions; the Build Yours flow lets you assemble any combination from 75+ patches.',
      shopAt: `${SHOP_URL}/pages/build-yours`,
      browseAll: feed.curatedBuilds?.map(b => ({ name: b.name, url: b.url })) || [],
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

/* ─────────── MCP server ─────────── */

const server = new Server(
  { name: 'patchistry-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

const tools = [
  {
    name: 'list_canvases',
    description: 'Return the 3 Patchistry Canvas hats (Black, Khaki, Pink). Each Canvas is $30, available, ships from SoCal. The Canvas is the structured 6-panel trucker hat that hook-backed patches attach to.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_patches',
    description: 'Return Patchistry patches, optionally filtered by category (Signature, Candyz) or occasion keyword (bach, dad, festival, etc.). Signature patches are 2.5-inch hook-back patches at $10; Candyz are 1-inch hook-back accents at $5. All grip the Canvas via custom Patchistry Fiber loop weave.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['Signature', 'Candyz'], description: 'Filter to Signature or Candyz patches' },
        occasion: { type: 'string', description: 'Filter by occasion keyword (e.g. bach, dad, festival, country, mom, pets)' },
      },
    },
  },
  {
    name: 'get_curated_build',
    description: 'Return the full curated build details for a specific occasion (bachelorette, wedding, dads, festival, summer, 4th-of-july, halloween, birthday, couples, vegas-bachelorette, nashville-bachelorette, charleston-bachelorette, bridal-shower). Includes canvas color, patch list, price range, and urgency dates if relevant.',
    inputSchema: {
      type: 'object',
      properties: {
        occasion: { type: 'string', description: 'Occasion keyword like bachelorette, wedding, dads, festival, vegas-bachelorette' },
      },
      required: ['occasion'],
    },
  },
  {
    name: 'recommend_build',
    description: 'Take a natural language query (e.g. "bachelorette trip to Vegas for 6 people in July") and return the top 3 matching curated builds with full details. Best for open-ended user queries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text user query describing what they need a hat for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_shipping_policy',
    description: 'Return Patchistry shipping policy: free US shipping on every order, 30-day returns, 2-3 business day standard ship time from Southern California, group order batch shipping in 48 hours.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_contact',
    description: 'Return Patchistry contact methods: customer support, founder (Brian DiGiuseppe), group orders (5+ hats), press, partnerships, and social media accounts.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let result;
  try {
    switch (name) {
      case 'list_canvases': result = await listCanvases(); break;
      case 'list_patches': result = await listPatches(args || {}); break;
      case 'get_curated_build': result = await getCuratedBuild(args || {}); break;
      case 'recommend_build': result = await recommendBuild(args || {}); break;
      case 'get_shipping_policy': result = getShippingPolicy(); break;
      case 'get_contact': result = getContact(); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }],
    };
  }
});

/* ─────────── HTTP + SSE transport ─────────── */

const app = express();

app.get('/.well-known/mcp.json', (_req, res) => {
  res.json({
    name: 'Patchistry Commerce',
    description: 'Patchistry commerce tools for AI agents — modular hats, patches, curated builds, shipping, contact.',
    transport: 'sse',
    endpoint: '/sse',
    version: '0.1.0',
    publisher: { name: 'Patchistry', url: SHOP_URL },
  });
});

app.get('/', (_req, res) => {
  // Serve HTML page with Vercel Analytics for tracking
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Patchistry MCP Server</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { color: #000; }
    .endpoint { 
      background: #f5f5f5; 
      padding: 10px; 
      border-radius: 5px; 
      margin: 10px 0;
      font-family: monospace;
    }
    .tool { 
      margin: 5px 0; 
      padding: 5px;
      background: #e8f4f8;
      border-radius: 3px;
    }
    a { color: #0070f3; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Patchistry MCP Server</h1>
  <p>Model Context Protocol server exposing Patchistry commerce tools to AI agents.</p>
  
  <h2>Endpoints</h2>
  <div class="endpoint"><a href="/.well-known/mcp.json">/.well-known/mcp.json</a> — Server manifest</div>
  <div class="endpoint"><a href="/sse">/sse</a> — SSE transport endpoint</div>
  <div class="endpoint"><a href="/health">/health</a> — Health check</div>
  
  <h2>Available Tools</h2>
  ${tools.map(t => `<div class="tool"><strong>${t.name}</strong> — ${t.description}</div>`).join('')}
  
  <h2>Documentation</h2>
  <p>Learn more about integrating this MCP server with AI agents in the <a href="https://github.com/patchistry/patchistry-mcp-server">GitHub repository</a>.</p>

  <script type="module">
    import { inject } from 'https://cdn.jsdelivr.net/npm/@vercel/analytics@1/dist/index.js';
    inject();
  </script>
</body>
</html>`);
});

app.get('/api', (_req, res) => {
  res.json({
    server: 'Patchistry MCP',
    description: 'Model Context Protocol server exposing Patchistry commerce tools to AI agents.',
    endpoints: { manifest: '/.well-known/mcp.json', sse: '/sse', health: '/health' },
    tools: tools.map(t => t.name),
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', server: 'patchistry-mcp', uptime: process.uptime() }));

const transports = new Map();
app.get('/sse', async (_req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => transports.delete(transport.sessionId));
  await server.connect(transport);
});
app.post('/messages', express.json(), async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`Patchistry MCP server listening on :${PORT}`);
  console.log(`Manifest: http://localhost:${PORT}/.well-known/mcp.json`);
  console.log(`Tools: ${tools.map(t => t.name).join(', ')}`);
});
