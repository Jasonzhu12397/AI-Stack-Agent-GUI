# =========================================================================
# Multi-Stage Production Containerfile for AI Agent Studio Backend
# Base: Node.js 22 LTS Alpine
# =========================================================================

FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build Vite client assets for production serving
RUN npm run build

# =========================================================================
# Production Runner
# =========================================================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend dist and backend server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose standard Control Plane API port
EXPOSE 3000

# Healthcheck probe against Control Plane API
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/v1/health || exit 1

# Start Node.js Express control plane server
CMD ["node", "--loader", "tsx", "server.ts"]
