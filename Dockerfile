# Patchistry MCP Server — for Glama indexing + introspection checks
# The production server runs on Vercel; this Dockerfile is for self-host + registry verification.
FROM node:20-alpine AS base

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json package-lock.json* ./

# Install only production deps
RUN npm install --omit=dev && npm cache clean --force

# Copy source
COPY src ./src
COPY mcp.json ./
COPY smithery.yaml ./

# Required env (none for stdio; HTTP server uses PORT)
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check — verify the server responds to introspection
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/.well-known/mcp.json || exit 1

# Run the server (Express HTTP, JSON-RPC 2.0 endpoint at /rpc)
CMD ["node", "src/index.js"]
