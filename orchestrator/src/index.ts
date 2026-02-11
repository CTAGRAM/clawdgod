// ──────────────────────────────────────────────────────────────
// ClawdGod — Orchestrator Entry Point
// Internal API for backend → orchestrator communication
// ──────────────────────────────────────────────────────────────

import "dotenv/config";
import Fastify from "fastify";
import {
    createAgent,
    stopAgent,
    restartAgent,
    deleteAgent,
    updateAgentFiles,
    getAgentStats,
    getAgentLogs,
} from "./containers.js";
import { startHealthChecks, trackAgent, untrackAgent } from "./health.js";
import type { SSHConfig } from "./ssh.js";
import type { ContainerCreateRequest } from "@clawdgod/shared";

const app = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || "info",
        transport:
            process.env.NODE_ENV !== "production"
                ? { target: "pino-pretty", options: { colorize: true } }
                : undefined,
    },
});

// ── Auth: shared secret with backend (skip for /health) ──
app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health") return;
    const token = request.headers["x-internal-token"];
    if (token !== process.env.INTERNAL_API_SECRET) {
        return reply.status(403).send({ error: "Forbidden" });
    }
});

// ── Helper: pick VPS node for new agent ──
function getNodeSSH(): SSHConfig {
    // For MVP, use a single node. Multi-node logic comes later.
    return {
        host: process.env.HETZNER_NODE_IP || "127.0.0.1",
        username: "root",
    };
}

// ── Create Agent ──
app.post("/internal/containers/create", async (request, reply) => {
    const body = request.body as ContainerCreateRequest;
    const ssh = getNodeSSH();

    try {
        const agentRef = await createAgent(ssh, body);
        trackAgent(body.agentId, ssh.host);
        return reply.send({ success: true, containerId: agentRef });
    } catch (err: any) {
        app.log.error(err, "Agent creation failed");
        return reply.status(500).send({ error: err.message });
    }
});

// ── Stop Agent ──
app.post<{ Params: { agentId: string } }>(
    "/internal/containers/:agentId/stop",
    async (request, reply) => {
        const { agentId } = request.params;
        const ssh = getNodeSSH();
        await stopAgent(ssh, agentId);
        untrackAgent(agentId);
        return reply.send({ success: true });
    }
);

// ── Restart Agent ──
app.post<{ Params: { agentId: string } }>(
    "/internal/containers/:agentId/restart",
    async (request, reply) => {
        const { agentId } = request.params;
        const ssh = getNodeSSH();
        await restartAgent(ssh, agentId);
        return reply.send({ success: true });
    }
);

// ── Delete Agent ──
app.delete<{ Params: { agentId: string } }>(
    "/internal/containers/:agentId",
    async (request, reply) => {
        const { agentId } = request.params;
        const ssh = getNodeSSH();
        await deleteAgent(ssh, agentId);
        untrackAgent(agentId);
        return reply.send({ success: true });
    }
);

// ── Update Files (hot reload) ──
app.put<{ Params: { agentId: string } }>(
    "/internal/containers/:agentId/files",
    async (request, reply) => {
        const { agentId } = request.params;
        const { files } = request.body as { files: { path: string; content: string }[] };
        const ssh = getNodeSSH();
        await updateAgentFiles(ssh, agentId, files);
        return reply.send({ success: true });
    }
);

// ── Agent Stats ──
app.get<{ Params: { agentId: string } }>(
    "/internal/containers/:agentId/stats",
    async (request, reply) => {
        const { agentId } = request.params;
        const ssh = getNodeSSH();
        const stats = await getAgentStats(ssh, agentId);
        return reply.send({ stats });
    }
);

// ── Agent Logs ──
app.get<{ Params: { agentId: string } }>(
    "/internal/containers/:agentId/logs",
    async (request, reply) => {
        const { agentId } = request.params;
        const ssh = getNodeSSH();
        const logs = await getAgentLogs(ssh, agentId);
        return reply.send({ logs });
    }
);

// ── Health ──
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// ── Start ──
async function start() {
    const port = parseInt(process.env.PORT || "3002");
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`ClawdGod Orchestrator running on port ${port}`);
    startHealthChecks();
}

start().catch((err) => {
    console.error("Failed to start orchestrator:", err);
    process.exit(1);
});
