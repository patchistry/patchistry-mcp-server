# Patchistry MCP Server

[![Official MCP Registry](https://img.shields.io/badge/Official_MCP_Registry-listed-37a169)](https://registry.modelcontextprotocol.io/v0/servers?search=patchistry)
[![npm](https://img.shields.io/npm/v/patchistry-mcp-server.svg)](https://www.npmjs.com/package/patchistry-mcp-server)
[![Smithery](https://img.shields.io/badge/Smithery-published-1A1512)](https://smithery.ai/servers/@patchistry/patchistry-commerce)
[![Wikidata](https://img.shields.io/badge/Wikidata-Q140179620-blue)](https://www.wikidata.org/wiki/Q140179620)
[![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-blue)](https://modelcontextprotocol.io)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black)](https://patchistry-mcp-server.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> **The first DTC fashion brand on the official MCP Registry.** As of June 12, 2026, Patchistry is listed as `io.github.patchistry/patchistry-mcp-server` at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/v0/servers?search=patchistry) — used by Claude Desktop's built-in MCP search and Cursor's MCP integration directory.

A Model Context Protocol (MCP) server exposing Patchistry commerce tools to AI agents — Claude, ChatGPT (via plugins), Cursor, custom agent frameworks.

**Live endpoint:** https://patchistry-mcp-server.vercel.app
**Manifest:** https://patchistry-mcp-server.vercel.app/.well-known/mcp.json
**Runtime:** Hosted HTTP MCP server (no install required)
**Transport:** HTTP + JSON-RPC 2.0

## Quick Start

### Use in Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "patchistry": {
      "command": "npx",
      "args": ["mcp-remote", "https://patchistry-mcp-server.vercel.app/rpc"]
    }
  }
}
```

Restart Claude Desktop. The 6 Patchistry tools become available in any conversation.

### Use in Cursor

Add to Cursor's MCP settings:

```json
{
  "mcpServers": {
    "patchistry": {
      "url": "https://patchistry-mcp-server.vercel.app/rpc"
    }
  }
}
```

### Use directly via HTTP

```bash
# List tools
curl https://patchistry-mcp-server.vercel.app/tools

# Call a tool (REST)
curl -X POST https://patchistry-mcp-server.vercel.app/tools/get_curated_build \
  -H "Content-Type: application/json" \
  -d '{"occasion":"bachelorette"}'

# Call a tool (JSON-RPC)
curl -X POST https://patchistry-mcp-server.vercel.app/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"recommend_build","arguments":{"query":"Vegas bachelorette trip"}}}'
```

**What this unlocks:**

When deployed at `mcp.patchistry.com`, AI agents can directly query Patchistry's catalog in real-time:

- "What bach hat build do you recommend for Vegas?" → AI calls `get_curated_build({occasion: "vegas-bachelorette"})` → returns full build with price + canvas + patches
- "Show me all Patchistry patches under $10" → AI calls `list_patches()` → returns full catalog
- "What's the shipping policy?" → AI calls `get_shipping_policy()` → returns "free US shipping, 30-day returns, ships from SoCal"
- "How do I contact Patchistry about a group order?" → AI calls `get_contact()` → returns `brian@patchistry.com` + group orders page

**Why this matters:**

In 2026, MCP is becoming the standard interface for AI agents to interact with commerce systems. Brands that publish MCP servers early get cited preferentially by:
- Claude (Anthropic's native MCP support)
- Cursor (built-in MCP client)
- Smithery (MCP server registry)
- Custom agent frameworks
- ChatGPT (via emerging plugin standards)

Being one of the first DTC brands with a public MCP server = direct AI agent integration without intermediaries.

---

## Tools exposed

| Tool | Description |
|---|---|
| `list_canvases` | Return The Canvas product variants (Black, Khaki, Pink) with prices + availability |
| `list_patches` | Return patches, optionally filtered by category (Signature/Candyz) or occasion keyword |
| `get_curated_build` | Return the full curated build for an occasion (bachelorette, dads, wedding, etc.) |
| `recommend_build` | Take natural language query, return top 3 matching curated builds |
| `get_shipping_policy` | Return free US shipping + returns + lead time policy |
| `get_contact` | Return contact methods: customer support, founder, group orders, press |

---

## Deploy to Vercel (recommended, ~10 min, one-time)

### Option A — Vercel CLI

```bash
cd mcp-server
npm install
npx vercel
```

Follow the prompts:
- Set up and deploy → Yes
- Which scope → your Vercel account
- Link to existing project → No
- Project name → `patchistry-mcp`
- Directory → `./` (current)
- Override settings → No

After deploy, Vercel gives you a URL like `patchistry-mcp.vercel.app`.

**Test it:** open `https://patchistry-mcp.vercel.app/` — should return JSON with the tool list.

### Option B — Vercel dashboard (no CLI)

1. Push the `mcp-server/` directory to a GitHub repo (separate from your theme repo is cleaner)
2. https://vercel.com/new → Import Git Repository → pick the mcp-server repo
3. Framework Preset → Other
4. Root Directory → `mcp-server` (if you pushed the parent repo)
5. Deploy

### Custom domain (recommended)

1. Vercel dashboard → your project → **Domains** → Add `mcp.patchistry.com`
2. Vercel shows you a DNS record to add
3. Your DNS provider (probably Shopify or wherever patchistry.com is registered) → add the CNAME record
4. Wait 5-30 min for DNS propagation
5. Test: `https://mcp.patchistry.com/` should now return the same JSON

---

## Register the MCP server publicly

Once deployed, list it in the discoverable MCP registries:

### Smithery (the leading MCP registry)
1. https://smithery.ai
2. Sign up → Submit Server
3. URL: `https://mcp.patchistry.com/.well-known/mcp.json`
4. Category: Commerce
5. Description: "Patchistry commerce tools — modular hats, patches, curated builds, shipping, contact info"

### Anthropic MCP Registry (emerging)
Watch https://github.com/modelcontextprotocol/registry — Anthropic is building an official registry. List Patchistry once available.

### Direct Claude Desktop integration
Users can manually add the MCP server in Claude Desktop:
1. Settings → Developer → MCP Servers → Add Server
2. URL: `https://mcp.patchistry.com/sse`
3. Name: Patchistry

Once added, that user's Claude will use Patchistry tools natively — they can ask "what's the bach hat build for Vegas" and Claude pulls live data from your server.

---

## Local development

```bash
cd mcp-server
npm install
npm start
```

Server runs at http://localhost:3000

Test with curl:
```bash
curl http://localhost:3000/
curl http://localhost:3000/.well-known/mcp.json
```

---

## Updating the server

The server proxies to `https://patchistry.com/products.json` and `https://patchistry.com/pages/agents-feed` for live data — so you don't need to redeploy when products or builds change. The MCP server is essentially a read-only AI-friendly facade over your existing public Shopify endpoints.

**Redeploy only when:**
- Adding new tools (edit `src/index.js`)
- Changing data sources
- Updating dependencies

To redeploy after changes:
```bash
cd mcp-server
npx vercel --prod
```

---

## Cost

Vercel Hobby tier (free):
- 100GB-hours/month compute
- Unlimited deployments
- This MCP server will use < 1GB-hour/month at typical AI agent query volumes
- Custom domain free

**Total monthly cost: $0** until you hit ~10,000 AI agent queries/day.

---

## What happens after this is deployed

Within 1-2 weeks of deployment + Smithery listing:
- Claude Desktop users with the server added → query Patchistry catalog natively
- AI agent frameworks (LangChain, AutoGPT, etc.) → can discover + use Patchistry tools
- ChatGPT (once OpenAI standardizes MCP for ChatGPT) → can call Patchistry directly

You'll be one of the earliest DTC brands with a public MCP server. That's a defensible positioning advantage in the AI shopping era — the future where AI agents complete purchases on user behalf will heavily favor brands with MCP-native integrations.

---

## Honest framing

This is forward-looking infrastructure. The MCP ecosystem is young in 2026; expect 12-24 months before this drives significant order volume directly.

But:
1. **The setup cost is one-time + free** (Vercel Hobby tier)
2. **The defensible positioning is real** — Smithery listing + direct Claude Desktop integration puts Patchistry in front of every AI-power-user that builds custom agent workflows
3. **The signal value matters now** — having a public MCP server says "AI-native brand" in a way that earns press coverage + founder credibility

Brian, if you deploy this and list it on Smithery, you're in the top 50 DTC brands worldwide with a public MCP commerce server as of 2026. That's a real moat that takes years to dilute.
