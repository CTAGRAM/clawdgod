#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ClawdGod — DigitalOcean Droplet Auto-Setup Script
# Run this ON THE DROPLET (after SSH-ing in)
# ──────────────────────────────────────────────────────────────
set -e

echo "🚀 Setting up ClawdGod on DigitalOcean..."

# Wait for cloud-init (user-data bootstrap) to finish
echo "⏳ Waiting for initial bootstrap to complete..."
while [ ! -f /var/lib/cloud/instance/boot-finished ]; do
    sleep 2
done
echo "✅ Bootstrap complete!"

# Ensure Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Ensure Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "📦 Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
fi

# Ensure Git
if ! command -v git &> /dev/null; then
    apt-get install -y git
fi

# Clone repo if not already cloned
if [ ! -d /opt/clawdgod ]; then
    echo "📥 Cloning ClawdGod..."
    cd /opt
    git clone https://github.com/CTAGRAM/clawdgod.git
fi

cd /opt/clawdgod

# Pull latest
echo "📥 Pulling latest code..."
git pull origin main

# Create .env.production
echo "📝 Creating .env.production..."
cat > .env.production << 'ENVEOF'
NODE_ENV=production
PORT=8000
FRONTEND_URL=https://peculiar-dorri-octagod-cdbd24f4.koyeb.app
DATABASE_URL=postgresql://neondb_owner:npg_kA1tmUYO0CwF@ep-dark-bar-air7a4xl-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require
UPSTASH_REDIS_URL=rediss://default:AcprAAIncDI1NTJhMDQzMGE1NjE0ZTlmOThmYmUxYzE0ZDMwY2VjMXAyNTE4MTk@pro-hornet-51819.upstash.io:6379
JWT_SECRET=fad0d8eb30a539600454b9fa3b3b5330fc002a84aebf875700b1bd7ac1b2d96a7981b594c143fdf66a9f743c54ab2c77b1fa5439119fa3ad1b47e7a2aa8706f8
MASTER_ENCRYPTION_KEY=0608ea54f0c12e74ac79ed98d0b200b38bac4cf7cf47a33c11d4879bc380888d
ABLY_API_KEY=sEJ3Cw.SnLMnQ:kLi1G71YU3ZqezvlykM7dtuvygjDGW0K0be6DbdQaIk
RESEND_API_KEY=re_YF1395sX_PoGgDmHfAhk4LzJ3FctzSsjN
FROM_EMAIL=hello@astitwa.ai
POLAR_ACCESS_TOKEN=polar_oat_rUlVMQ0dCdOB3yEWduIYl6ywEIyOmebTb0ome1qYXgm
POLAR_WEBHOOK_SECRET=
POLAR_STARTER_PRODUCT_ID=6ecea1c3-4a1e-4f8d-a97a-068114369711
POLAR_PRO_PRODUCT_ID=80a1af22-e9e0-43d3-8f13-d9d735e44172
POLAR_BUILDER_PRODUCT_ID=ba39d431-4894-4913-b0e9-9105141f3b57
INTERNAL_API_SECRET=e82aa87caa213bb297204114747054e80c8424c2bea7627b19184aee39426f48
GOOGLE_CLIENT_ID=1072377148392-fd691id5sdikkd09mfhn9noaq0uhbk05.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_ABLY_KEY=sEJ3Cw.zuKAsQ:yZnDJyG3EN8BOFFEExrCuI0kvaY0NKG4aCydWQdXgqk
NEXT_PUBLIC_GOOGLE_CLIENT_ID=1072377148392-fd691id5sdikkd09mfhn9noaq0uhbk05.apps.googleusercontent.com
ORCHESTRATOR_URL=
ENVEOF

# Configure Caddy for IP-only access (no domain yet)
echo "📝 Configuring Caddy..."
cat > Caddyfile << 'CADDYEOF'
:80 {
    reverse_proxy app:8000

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }

    encode gzip
}
CADDYEOF

# Open firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Build and start
echo "🏗️ Building and starting ClawdGod..."
docker compose up -d --build

echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ ClawdGod is deploying!"
echo "  🌐 Access: http://143.244.132.222"
echo "  📋 Logs:   docker compose logs -f"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  Build takes 3-5 minutes. Monitor with:"
echo "  cd /opt/clawdgod && docker compose logs -f"
echo ""
