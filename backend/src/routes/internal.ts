// ──────────────────────────────────────────────────────────────
// ClawdGod — Internal Routes (Orchestrator ↔ Backend)
// Authenticated via shared INTERNAL_API_SECRET
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { agents, tasks, agentChannels } from "../db/schema.js";
import { publishEvent } from "../lib/ably.js";
import type { TaskEventPayload } from "@clawdgod/shared";

// Simple shared-secret auth for internal service comms
async function requireInternalAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = request.headers["x-internal-token"];
    const expected = process.env.INTERNAL_API_SECRET;
    if (!expected || token !== expected) {
        return reply.status(403).send({ error: "Forbidden" });
    }
}

export async function internalRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireInternalAuth);

    // ── Container status update ──
    app.post<{ Params: { agentId: string } }>(
        "/internal/agents/:agentId/status",
        async (request, reply) => {
            const { agentId } = request.params;
            const { status, containerId } = request.body as any;

            const [agent] = await db
                .select()
                .from(agents)
                .where(eq(agents.id, agentId))
                .limit(1);

            if (!agent) return reply.status(404).send({ error: "Agent not found" });

            await db
                .update(agents)
                .set({
                    status,
                    containerId: containerId ?? agent.containerId,
                    updatedAt: new Date(),
                })
                .where(eq(agents.id, agentId));

            await publishEvent(agentId, agent.userId, "agent.status", { status });

            return reply.send({ success: true });
        }
    );

    // ── Task event from Log Agent ──
    app.post("/internal/task-events", async (request, reply) => {
        const payload = request.body as TaskEventPayload;

        const [agent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, payload.agentId))
            .limit(1);

        if (!agent) return reply.status(404).send({ error: "Agent not found" });

        switch (payload.event) {
            case "task.started": {
                await db.insert(tasks).values({
                    agentId: payload.agentId,
                    externalId: payload.data.externalId,
                    status: "in_progress",
                    summary: payload.data.summary,
                    startedAt: new Date(),
                });
                break;
            }

            case "task.step": {
                const [existing] = await db
                    .select()
                    .from(tasks)
                    .where(eq(tasks.externalId, payload.data.externalId))
                    .limit(1);

                if (existing && payload.data.step) {
                    const currentSteps = (existing.steps as any[]) || [];
                    currentSteps.push(payload.data.step);
                    await db
                        .update(tasks)
                        .set({ steps: currentSteps })
                        .where(eq(tasks.id, existing.id));
                }
                break;
            }

            case "task.completed": {
                await db
                    .update(tasks)
                    .set({
                        status: "completed",
                        tokensUsed: payload.data.tokensUsed,
                        durationMs: payload.data.durationMs,
                        completedAt: new Date(),
                    })
                    .where(eq(tasks.externalId, payload.data.externalId));
                break;
            }

            case "task.failed": {
                await db
                    .update(tasks)
                    .set({
                        status: "failed",
                        errorMessage: payload.data.error,
                        completedAt: new Date(),
                    })
                    .where(eq(tasks.externalId, payload.data.externalId));
                break;
            }
        }

        // Publish to Ably for real-time dashboard
        await publishEvent(payload.agentId, agent.userId, payload.event, payload.data);

        return reply.send({ received: true });
    });

    // ── Channel status update ──
    app.post<{ Params: { agentId: string } }>(
        "/internal/agents/:agentId/channels/:channelType/status",
        async (request, reply) => {
            const { agentId, channelType } = request.params as any;
            const { status } = request.body as any;

            await db
                .update(agentChannels)
                .set({ status, updatedAt: new Date() })
                .where(eq(agentChannels.agentId, agentId));

            const [agent] = await db
                .select()
                .from(agents)
                .where(eq(agents.id, agentId))
                .limit(1);

            if (agent) {
                await publishEvent(agentId, agent.userId, "channel.status", {
                    channelType,
                    status,
                });
            }

            return reply.send({ success: true });
        }
    );
}
