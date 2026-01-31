# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN bun install

# Copy source files
COPY tsconfig.json biome.json ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY packages/frontend ./packages/frontend

# Build frontend only
WORKDIR /app/packages/frontend
RUN bun run build

# Production stage - use full bun image for native modules
FROM oven/bun:1 AS production

WORKDIR /app

# Copy everything from builder (including node_modules)
COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/backend ./packages/backend
COPY --from=builder /app/packages/frontend/dist ./packages/backend/public

# Create data directory for SQLite
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/observer.db

EXPOSE 3001

WORKDIR /app/packages/backend

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Run migrations and then start server
CMD bun run src/db/migrate.ts && bun run src/index.ts
