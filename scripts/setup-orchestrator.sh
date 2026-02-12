#!/bin/bash
# ──────────────────────────────────────────────────────────────
# ClawdGod — Orchestrator + OpenClaw Setup for DigitalOcean Droplet
#
# Prerequisites: Upload openclaw source to /opt/openclaw first:
#   tar czf /tmp/openclaw.tar.gz -C /path/to/openclaw-main .
#   scp /tmp/openclaw.tar.gz root@YOUR_DROPLET_IP:/tmp/
#
# Then run this script on the droplet.
# ──────────────────────────────────────────────────────────────

set -euo pipefail

echo "═══════════════════════════════════════════════"
echo "  ClawdGod Orchestrator Setup"
echo "═══════════════════════════════════════════════"

# ── 1. Install Node.js 22 (if not already installed) ──
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
    echo "📦 Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi
echo "✅ Node.js $(node -v)"

# ── 2. Install pnpm (if not already installed) ──
if ! command -v pnpm &>/dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm -v)"

# ── 3. Install Bun (required by OpenClaw build) ──
if ! command -v bun &>/dev/null; then
    echo "📦 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
    echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
fi
echo "✅ Bun $(bun --version 2>/dev/null || echo 'installed')"

# ── 4. Extract and build OpenClaw ──
OPENCLAW_DIR="/opt/openclaw"
OPENCLAW_TARBALL="/tmp/openclaw.tar.gz"

if [ -f "$OPENCLAW_TARBALL" ]; then
    echo "📦 Extracting OpenClaw..."
    mkdir -p "$OPENCLAW_DIR"
    tar xzf "$OPENCLAW_TARBALL" -C "$OPENCLAW_DIR"
    rm -f "$OPENCLAW_TARBALL"
elif [ ! -d "$OPENCLAW_DIR/src" ]; then
    echo "❌ No OpenClaw source found!"
    echo "   Upload it first:"
    echo "   scp /tmp/openclaw.tar.gz root@$(hostname -I | awk '{print $1}'):/tmp/"
    exit 1
fi

cd "$OPENCLAW_DIR"
echo "📦 Installing OpenClaw dependencies (this may take a few minutes)..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "📦 Building OpenClaw..."
pnpm build

# Try to build UI (some installs may fail — non-critical)
echo "📦 Building OpenClaw UI..."
OPENCLAW_PREFER_PNPM=1 pnpm ui:build 2>/dev/null || echo "  ⚠️ UI build skipped (non-critical)"

# Create a wrapper script
cat > /usr/local/bin/openclaw << 'WRAPPER'
#!/bin/bash
export PATH="$HOME/.bun/bin:$PATH"
cd /opt/openclaw
exec node openclaw.mjs "$@"
WRAPPER
chmod +x /usr/local/bin/openclaw

echo "✅ OpenClaw installed at /usr/local/bin/openclaw"

# ── 5. Build the orchestrator ──
CLAWDGOD_DIR="/opt/clawdgod"
ORCH_DIR="$CLAWDGOD_DIR/orchestrator"

echo "📦 Building orchestrator..."
cd "$CLAWDGOD_DIR"

# Install workspace deps for orchestrator and shared
pnpm install --filter @clawdgod/orchestrator --filter @clawdgod/shared 2>/dev/null || \
    (cd shared && npm install && cd ../orchestrator && npm install)

cd "$ORCH_DIR"
npx tsc 2>/dev/null || pnpm build

echo "✅ Orchestrator built"

# ── 6. Create orchestrator .env ──
INTERNAL_SECRET=""
if [ -f "$CLAWDGOD_DIR/.env.production" ]; then
    INTERNAL_SECRET=$(grep "^INTERNAL_API_SECRET=" "$CLAWDGOD_DIR/.env.production" | cut -d= -f2-)
fi

if [ -z "$INTERNAL_SECRET" ]; then
    INTERNAL_SECRET="clawdgod-internal-$(openssl rand -hex 16)"
    echo "⚠️  Generated new INTERNAL_API_SECRET: $INTERNAL_SECRET"
    echo "   Add this to your .env.production too!"
fi

cat > "$ORCH_DIR/.env" << EOF
PORT=3002
NODE_ENV=production
LOG_LEVEL=info
BACKEND_URL=http://localhost:8000
INTERNAL_API_SECRET=$INTERNAL_SECRET
OPENCLAW_BIN=/usr/local/bin/openclaw
EOF
echo "✅ Orchestrator .env created"

# ── 7. Create systemd service for the orchestrator ──
cat > /etc/systemd/system/clawdgod-orchestrator.service << EOF
[Unit]
Description=ClawdGod Orchestrator
After=network.target

[Service]
Type=simple
WorkingDirectory=$ORCH_DIR
EnvironmentFile=$ORCH_DIR/.env
Environment=PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.bun/bin
ExecStart=$(which node) dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=clawdgod-orchestrator

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable clawdgod-orchestrator
systemctl restart clawdgod-orchestrator

# Wait a moment and check status
sleep 2
if systemctl is-active --quiet clawdgod-orchestrator; then
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "  ✅ Orchestrator is running on port 3002"
    echo "═══════════════════════════════════════════════"
else
    echo ""
    echo "❌ Orchestrator failed to start. Check logs:"
    echo "   journalctl -u clawdgod-orchestrator -n 20 --no-pager"
    exit 1
fi

# ── 8. Update ClawdGod .env.production ──
if [ -f "$CLAWDGOD_DIR/.env.production" ]; then
    if grep -q "^ORCHESTRATOR_URL=" "$CLAWDGOD_DIR/.env.production"; then
        sed -i 's|^ORCHESTRATOR_URL=.*|ORCHESTRATOR_URL=http://host.docker.internal:3002|' "$CLAWDGOD_DIR/.env.production"
    else
        echo "ORCHESTRATOR_URL=http://host.docker.internal:3002" >> "$CLAWDGOD_DIR/.env.production"
    fi
    echo "✅ Updated .env.production with ORCHESTRATOR_URL"
fi

echo ""
echo "Next steps:"
echo "  1. Restart ClawdGod app:"
echo "     cd /opt/clawdgod && docker compose down && docker compose up -d"
echo "  2. Deploy an agent from the wizard!"
echo "  3. Monitor: journalctl -u clawdgod-orchestrator -f"
