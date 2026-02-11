// ──────────────────────────────────────────────────────────────
// ClawdGod — Fastify Entry Point
// Registers all plugins, middleware, and routes
// ──────────────────────────────────────────────────────────────

import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";

import { authRoutes } from "./routes/auth.js";
import { agentRoutes } from "./routes/agents.js";
import { taskRoutes } from "./routes/tasks.js";
import { billingRoutes } from "./routes/billing.js";
import { personalizationRoutes } from "./routes/personalization.js";
import { internalRoutes } from "./routes/internal.js";
import { modelRoutes } from "./routes/models.js";

import { startTrialEnforcer } from "./lib/trial-enforcer.js";

const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || "info",
        transport:
            process.env.NODE_ENV !== "production"
                ? { target: "pino-pretty", options: { colorize: true } }
                : undefined,
    },
});

async function start() {
    // ── CORS ──
    await app.register(fastifyCors, {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
    });

    // ── JWT ──
    await app.register(fastifyJwt, {
        secret: process.env.JWT_SECRET || "clawdgod-dev-secret-change-in-production",
        cookie: { cookieName: "refreshToken", signed: false },
    });

    // ── Cookies ──
    await app.register(fastifyCookie);

    // ── Rate Limiting ──
    await app.register(fastifyRateLimit, {
        max: 100,
        timeWindow: "1 minute",
    });

    // ── Health Check ──
    app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

    // ── Routes ──
    await app.register(authRoutes);
    await app.register(agentRoutes);
    await app.register(taskRoutes);
    await app.register(billingRoutes);
    await app.register(personalizationRoutes);
    await app.register(internalRoutes);
    await app.register(modelRoutes);

    // ── Start Server ──
    const port = parseInt(process.env.PORT || "3001");
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({ port, host });
    app.log.info(`ClawdGod Backend running on http://${host}:${port}`);

    // ── Start Trial Enforcer (server-side cron) ──
    startTrialEnforcer();
}

start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
