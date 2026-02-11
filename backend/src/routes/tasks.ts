// ──────────────────────────────────────────────────────────────
// ClawdGod — Task Routes
// GET /api/agents/:id/tasks — paginated, filterable task feed
// GET /api/agents/:id/tasks/:taskId — full task detail
// GET /api/agents/:id/tasks/stats — aggregated stats
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { tasks, agents } from "../db/schema.js";
import { requireAuth, getUserId } from "../middleware/auth.js";

export async function taskRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireAuth);

    // ── List Tasks (Paginated) ──
    app.get<{
        Params: { id: string };
        Querystring: {
            status?: string;
            channel?: string;
            page?: string;
            limit?: string;
        };
    }>("/api/agents/:id/tasks", async (request, reply) => {
        const userId = getUserId(request);
        const { id } = request.params;
        const { status, channel, page = "1", limit = "20" } = request.query;

        // Verify ownership
        const [agent] = await db
            .select()
            .from(agents)
            .where(and(eq(agents.id, id), eq(agents.userId, userId)))
            .limit(1);

        if (!agent) return reply.status(404).send({ error: "Agent not found" });

        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = db
            .select()
            .from(tasks)
            .where(eq(tasks.agentId, id))
            .orderBy(desc(tasks.createdAt))
            .limit(parseInt(limit))
            .offset(offset);

        const result = await query;

        // Filter in JS for simplicity (can optimize to SQL later)
        let filtered = result;
        if (status) filtered = filtered.filter((t) => t.status === status);
        if (channel) filtered = filtered.filter((t) => t.channelType === channel);

        return reply.send({ tasks: filtered, page: parseInt(page), limit: parseInt(limit) });
    });

    // ── Task Detail ──
    app.get<{ Params: { id: string; taskId: string } }>(
        "/api/agents/:id/tasks/:taskId",
        async (request, reply) => {
            const userId = getUserId(request);
            const { id, taskId } = request.params;

            // Verify ownership
            const [agent] = await db
                .select()
                .from(agents)
                .where(and(eq(agents.id, id), eq(agents.userId, userId)))
                .limit(1);

            if (!agent) return reply.status(404).send({ error: "Agent not found" });

            const [task] = await db
                .select()
                .from(tasks)
                .where(and(eq(tasks.id, taskId), eq(tasks.agentId, id)))
                .limit(1);

            if (!task) return reply.status(404).send({ error: "Task not found" });

            return reply.send({ task });
        }
    );

    // ── Task Stats ──
    app.get<{ Params: { id: string } }>(
        "/api/agents/:id/tasks/stats",
        async (request, reply) => {
            const userId = getUserId(request);
            const { id } = request.params;

            // Verify ownership
            const [agent] = await db
                .select()
                .from(agents)
                .where(and(eq(agents.id, id), eq(agents.userId, userId)))
                .limit(1);

            if (!agent) return reply.status(404).send({ error: "Agent not found" });

            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(todayStart);
            weekStart.setDate(weekStart.getDate() - 7);

            // Get counts by status
            const allTasks = await db
                .select()
                .from(tasks)
                .where(eq(tasks.agentId, id));

            const todayTasks = allTasks.filter(
                (t) => t.createdAt && new Date(t.createdAt) >= todayStart
            );
            const weekTasks = allTasks.filter(
                (t) => t.createdAt && new Date(t.createdAt) >= weekStart
            );

            const statusCounts: Record<string, number> = {};
            for (const t of allTasks) {
                statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
            }

            const channelCounts: Record<string, number> = {};
            for (const t of allTasks) {
                if (t.channelType) {
                    channelCounts[t.channelType] = (channelCounts[t.channelType] || 0) + 1;
                }
            }

            return reply.send({
                stats: {
                    today: todayTasks.length,
                    thisWeek: weekTasks.length,
                    total: allTasks.length,
                    byStatus: statusCounts,
                    byChannel: channelCounts,
                },
            });
        }
    );
}
