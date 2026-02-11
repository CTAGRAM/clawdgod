# ClawdGod — Service Account Setup Guide

Follow these steps to set up all required external service accounts.
You already have **Polar.sh** ✅ — skip that section.

---

## 1. Neon (PostgreSQL Database)
1. Go to [neon.tech](https://neon.tech) and sign up (free tier available)
2. Create a new Project named **"clawdgod"**
3. Copy the connection string (starts with `postgresql://`)
4. Paste into `backend/.env` as `DATABASE_URL`

## 2. Upstash (Redis)
1. Go to [upstash.com](https://upstash.com) and sign up (free tier available)
2. Create a new Redis database, region: closest to your users
3. Copy the Redis URL (starts with `rediss://`)
4. Paste into `backend/.env` as `UPSTASH_REDIS_URL`

## 3. Ably (Real-time Push)
1. Go to [ably.com](https://ably.com) and sign up (free tier: 6M messages/mo)
2. Create a new App named **"clawdgod"**
3. Go to API Keys tab → copy the key (format: `xxxxx.xxxxxx:xxxxxxx`)
4. Paste into `backend/.env` as `ABLY_API_KEY`
5. The public portion (before the `:`) goes into `frontend/.env` as `NEXT_PUBLIC_ABLY_KEY`

## 4. Resend (Transactional Email)
1. Go to [resend.com](https://resend.com) and sign up
2. Add and verify your domain (or use their test domain for dev)
3. Create an API key → paste into `backend/.env` as `RESEND_API_KEY`
4. Set `FROM_EMAIL` to your verified email address

## 5. Anthropic (Claude API — for personalization)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key → paste into `backend/.env` as `ANTHROPIC_API_KEY`
3. This is used server-side to generate SOUL/USER/TOOLS.md files

## 6. Hetzner (VPS for Agent Containers)
1. Go to [hetzner.com](https://www.hetzner.com/cloud) and sign up
2. Create a Cloud project named **"clawdgod"**
3. Add your SSH public key in **Security → SSH Keys**
4. Create a server:
   - Image: **Ubuntu 24.04**
   - Type: **CX22** (2 vCPU, 4GB RAM, €4.35/mo) — handles ~4 agents
   - Location: closest to your users
5. Note the IP address → paste into `orchestrator/.env` as `HETZNER_NODE_IP`
6. SSH in and run initial setup:
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   
   # Create ClawdGod network
   docker network create clawdgod-net
   
   # Pull OpenClaw image
   docker pull openclaw:latest
   
   # Create agent directory
   mkdir -p /opt/clawdgod/agents
   ```

## 7. Generate Secrets
Run these commands to generate all required secrets:
```bash
# JWT Secret (64 bytes)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Master Encryption Key (32 bytes)
node -e "console.log('MASTER_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Internal API Secret (32 bytes)
node -e "console.log('INTERNAL_API_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output into both `backend/.env` and `orchestrator/.env`.

## 8. Polar.sh (Already Have ✅)
1. Create 3 products: **Starter ($29)**, **Pro ($59)**, **Builder ($99)**
2. Copy each product ID → paste into `backend/.env`:
   - `POLAR_STARTER_PRODUCT_ID`
   - `POLAR_PRO_PRODUCT_ID`
   - `POLAR_BUILDER_PRODUCT_ID`
3. Create a webhook pointing to `https://your-backend.com/webhooks/polar`
4. Copy the webhook secret → `POLAR_WEBHOOK_SECRET`
5. Create an access token → `POLAR_ACCESS_TOKEN`

---

## Quick Start After Setup

```bash
cd /Users/rudra/Documents/Paisa/clawdgod

# Install all deps
pnpm install

# Copy env files
cp backend/.env.example backend/.env
cp orchestrator/.env.example orchestrator/.env
cp frontend/.env.example frontend/.env

# Fill in your values in each .env file, then:

# Push database schema
pnpm db:push

# Start development servers
pnpm dev
```
