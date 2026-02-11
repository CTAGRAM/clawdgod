#!/bin/sh
# ──────────────────────────────────────────────────────────────
# ClawdGod — Combined Entrypoint
# Runs both backend (Fastify) and frontend (Next.js) in one container
# ──────────────────────────────────────────────────────────────

# Backend runs on internal port 3001
# Frontend runs on the external PORT (Koyeb sets this, default 8000)

echo "Starting ClawdGod Backend on port 3001..."
PORT=3001 HOST=0.0.0.0 node /app/backend/dist/index.js &
BACKEND_PID=$!

# Wait for backend to be healthy
echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
    if wget -q -O - http://localhost:3001/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

echo "Starting ClawdGod Frontend on port ${PORT:-8000}..."
HOSTNAME=0.0.0.0 node /app/frontend/server.js &
FRONTEND_PID=$!

echo "Both services running. Backend PID=$BACKEND_PID, Frontend PID=$FRONTEND_PID"

# Trap signals to forward to children
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" TERM INT

# Wait for all background processes (POSIX-compatible)
wait
EXIT_CODE=$?

echo "A process exited with code $EXIT_CODE. Shutting down..."
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
exit $EXIT_CODE
