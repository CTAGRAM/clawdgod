# ClawdGod — Deployment Guide

## Local Development

```bash
# Install dependencies
pnpm install

# Push DB schema (first time only)
pnpm db:push

# Start all 3 services (backend:3001, frontend:3000, orchestrator:3002)
pnpm dev
```

## Environment Variables

### Backend (backend/.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Backend port (default: 3001) | ✅ |
| `DATABASE_URL` | Neon PostgreSQL connection string | ✅ |
| `JWT_SECRET` | JWT signing secret (64+ hex chars) | ✅ |
| `MASTER_ENCRYPTION_KEY` | AES-256 key for API key encryption (64 hex chars) | ✅ |
| `INTERNAL_API_SECRET` | Shared secret for backend↔orchestrator auth | ✅ |
| `ORCHESTRATOR_URL` | Orchestrator URL (default: http://localhost:3002) | ✅ |
| `FRONTEND_URL` | Frontend URL for CORS + redirects | ✅ |
| `UPSTASH_REDIS_URL` | Redis for rate limiting | ✅ |
| `ABLY_API_KEY` | Ably for real-time push events | ✅ |
| `RESEND_API_KEY` | Resend for transactional emails | ✅ |
| `FROM_EMAIL` | Sender email address | ✅ |
| `POLAR_ACCESS_TOKEN` | Polar.sh API token | ✅ |
| `POLAR_WEBHOOK_SECRET` | Polar webhook HMAC secret | ⚠️ Prod |
| `POLAR_STARTER_PRODUCT_ID` | Polar product ID for Starter plan | ✅ |
| `POLAR_PRO_PRODUCT_ID` | Polar product ID for Pro plan | ✅ |
| `POLAR_BUILDER_PRODUCT_ID` | Polar product ID for Builder plan | ✅ |

### Orchestrator (orchestrator/.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Orchestrator port (default: 3002) | ✅ |
| `BACKEND_URL` | Backend URL for status callbacks | ✅ |
| `INTERNAL_API_SECRET` | Shared secret (must match backend) | ✅ |
| `HETZNER_NODE_IP` | VPS IP address | ✅ |
| `HETZNER_SSH_PRIVATE_KEY` | Path to SSH private key file | ✅ |

### Frontend (frontend/.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | ✅ |

## VPS Setup (Hetzner)

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Create network
docker network create clawdgod-net

# 3. Create agent directory
mkdir -p /opt/clawdgod/agents

# 4. Build OpenClaw image (upload Dockerfile first)
scp docker/Dockerfile.openclaw root@<VPS_IP>:/opt/clawdgod/
ssh root@<VPS_IP> "cd /opt/clawdgod && docker build -t openclaw:latest -f Dockerfile.openclaw ."
```

## Production Build

```bash
pnpm build

# Start services
pnpm start:backend
pnpm start:orchestrator
# Frontend: deploy via Vercel or `next start`
```
