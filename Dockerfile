# ──────────────────────────────────────────────────────────────
# ClawdGod — Combined Dockerfile (Frontend + Backend)
# Single container for Koyeb deployment
# ──────────────────────────────────────────────────────────────

# ── Stage 1: Build Everything ──
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

WORKDIR /app

# Copy entire monorepo (filtered by .dockerignore)
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Clean any stale build artifacts and build shared → backend → frontend
RUN rm -rf shared/dist shared/tsconfig.tsbuildinfo backend/dist
RUN pnpm --filter @clawdgod/shared run build
RUN pnpm --filter @clawdgod/backend run build

# NEXT_PUBLIC_* vars are baked in at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ABLY_KEY
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ABLY_KEY=$NEXT_PUBLIC_ABLY_KEY
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

RUN pnpm --filter @clawdgod/frontend run build

# Prune to production dependencies
RUN pnpm install --frozen-lockfile --prod

# ── Stage 2: Production ──
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# ── Backend artifacts ──
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/shared/package.json shared/
COPY --from=builder /app/shared/dist/ shared/dist/
COPY --from=builder /app/backend/package.json backend/
COPY --from=builder /app/backend/dist/ backend/dist/

# ── Frontend artifacts (Next.js standalone) ──
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static

# ── Production node_modules ──
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/shared/node_modules/ shared/node_modules/
COPY --from=builder /app/backend/node_modules/ backend/node_modules/

# ── Entrypoint ──
COPY --from=builder /app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Koyeb exposes this port (frontend serves here)
EXPOSE 8000

ENV PORT=8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -q -O - http://localhost:3001/health || exit 1

CMD ["/app/entrypoint.sh"]
