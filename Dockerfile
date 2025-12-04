# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN bun install --no-save

# Copy source files
COPY tsconfig.json biome.json ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY packages/frontend ./packages/frontend

# Build frontend
WORKDIR /app/packages/frontend
RUN bun run build

# Build backend
WORKDIR /app/packages/backend
RUN bun build --target=bun src/index.ts --outdir=dist

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

# Install only production dependencies (without lockfile to avoid mismatch)
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
RUN bun install --production

# Copy built files
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/frontend/dist ./packages/backend/public
COPY --from=builder /app/packages/shared ./packages/shared

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

CMD ["bun", "run", "dist/index.js"]
