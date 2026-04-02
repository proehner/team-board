# ─── Stage 1: Frontend Build ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ./
COPY src/ ./src/
RUN npm run build

# ─── Stage 2: Backend Build ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/src/ ./src/
COPY server/tsconfig.json ./
RUN npm run build

# ─── Stage 3: Production Image ────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Frontend build output (served as static files by Express)
COPY --from=frontend-builder /app/dist ./dist

# Backend compiled output
COPY --from=backend-builder /app/server/dist ./server/dist

# Production dependencies only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Persistent data directory for SQLite
RUN mkdir -p /app/server/data

EXPOSE 3001
CMD ["node", "server/dist/index.js"]
