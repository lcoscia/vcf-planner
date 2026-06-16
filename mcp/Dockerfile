# VCF Planner MCP server image.
# IMPORTANT: build with the REPO ROOT as the build context (not mcp/), because the
# server imports ../core at runtime. docker-compose.yml sets `context: ..` for you.
#   docker build -f mcp/Dockerfile -t vcf-planner-mcp .
FROM node:22-alpine

WORKDIR /app

# Install production deps first for better layer caching.
COPY mcp/package*.json ./mcp/
WORKDIR /app/mcp
RUN npm ci --omit=dev || npm install --omit=dev

# Copy the shared core (imported as ../core) and the server source.
WORKDIR /app
COPY core ./core
COPY mcp ./mcp

WORKDIR /app/mcp

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
