// ──────────────────────────────────────────────────────────────
// ClawdGod — Personalization Routes
// Edit SOUL/USER/TOOLS, regenerate, version history, rollback
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { agents, agentPersonalization } from "../db/schema.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { generateAllPersonalizationFiles } from "../lib/personalization.js";
import type { WizardAnswers } from "@clawdgod/shared";

const updateSchema = z.object({
    soulMd: z.string().optional(),
    userMd: z.string().optional(),
    toolsMd: z.string().optional(),
});

export async function personalizationRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireAuth);

    // ── Get Current Personalization ──
    app.get<{ Params: { id: string } }>(
        "/api/agents/:id/personalization",
        async (request, reply) => {
            const userId = getUserId(request);
            const { id } = request.params;

            const [agent] = await db
                .select()
                .from(agents)
                .where(and(eq(agents.id, id), eq(agents.userId, userId)))
                .limit(1);
            if (!agent) return reply.status(404).send({ error: "Agent not found" });

            const [current] = await db
                .select()
                .from(agentPersonalization)
                .where(eq(agentPersonalization.agentId, id))
                .orderBy(desc(agentPersonalization.version))
                .limit(1);

            return reply.send({ personalization: current || null });
        }
    );

    // ── Update Personalization (Manual Edit) ──
    app.put<{ Params: { id: string } }>(
        "/api/agents/:id/personalization",
        async (request, reply) => {
            const userId = getUserId(request);
            const { id } = request.params;
            const parsed = updateSchema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
            }

            const [agent] = await db
                .select()
                .from(agents)
                .where(and(eq(agents.id, id), eq(agents.userId, userId)))
                .limit(1);
            if (!agent) return reply.status(404).send({ error: "Agent not found" });

            // Get current version
            const [current] = await db
                .select()
                .from(agentPersonalization)
                .where(eq(agentPersonalization.agentId, id))
                .orderBy(desc(agentPersonalization.version))
                .limit(1);

            if (!current) return reply.status(404).send({ error: "No personalization found" });

            // Create new version
            const newVersion = current.version + 1;
            const [updated] = await db
                .insert(agentPersonalization)
                .values({
                    agentId: id,
                    wizardAnswers: current.wizardAnswers as any,
                    soulMd: parsed.data.soulMd ?? current.soulMd,
                    userMd: parsed.data.userMd ?? current.userMd,
                    toolsMd: parsed.data.toolsMd ?? current.toolsMd,
                    version: newVersion,
                })
                .returning();

            // TODO: Push updated files to container (no restart needed)

            return reply.send({ personalization: updated });
        }
    );

    // ── Regenerate All Files ──
    app.post<{ Params: { id: string } }>(
        "/api/agents/:id/personalization/regenerate",
        async (request, reply) => {
            const userId = getUserId(request);
            const { id } = request.params;

            const [agent] = await db
                .select()
                .from(agents)
                .where(and(eq(agents.id, id), eq(agents.userId, userId)))
                .limit(1);
            if (!agent) return reply.status(404).send({ error: "Agent not found" });

            const [current] = await db
                .select()
                .from(agentPersonalization)
                .where(eq(agentPersonalization.agentId, id))
                .orderBy(desc(agentPersonalization.version))
                .limit(1);

            if (!current) return reply.status(404).send({ error: "No personalization found" });

            const answers = current.wizardAnswers as unknown as WizardAnswers;
            const { soulMd, userMd, toolsMd } = await generateAllPersonalizationFiles(answers);

            const [newPersonalization] = await db
                .insert(agentPersonalization)
                .values({
                    agentId: id,
                    wizardAnswers: current.wizardAnswers as any,
                    soulMd,
                    userMd,
                    toolsMd,
                    version: current.version + 1,
                })
                .returning();

            return reply.send({ personalization: newPersonalization });
        }
    );

    // ── Version History ──
    app.get<{ Params: { id: string } }>(
        "/api/agents/:id/personalization/versions",
        async (request, reply) => {
            const userId = getUserId(request);
            const { id } = request.params;

            const [agent] = await db
                .select()
                .from(agents)
                .where(and(eq(agents.id, id), eq(agents.userId, userId)))
                .limit(1);
            if (!agent) return reply.status(404).send({ error: "Agent not found" });

            const versions = await db
                .select({
                    id: agentPersonalization.id,
                    version: agentPersonalization.version,
                    createdAt: agentPersonalization.createdAt,
                })
                .from(agentPersonalization)
                .where(eq(agentPersonalization.agentId, id))
                .orderBy(desc(agentPersonalization.version))
                .limit(10);

            return reply.send({ versions });
        }
    );

    // ── Rollback to Version ──
    app.post<{ Params: { id: string; versionId: string } }>(
        "/api/agents/:id/personalization/rollback/:versionId",
        async (request, reply) => {
            const userId = getUserId(request);
            const { id, versionId } = request.params;

            const [agent] = await db
                .select()
                .from(agents)
                .where(and(eq(agents.id, id), eq(agents.userId, userId)))
                .limit(1);
            if (!agent) return reply.status(404).send({ error: "Agent not found" });

            const [target] = await db
                .select()
                .from(agentPersonalization)
                .where(
                    and(eq(agentPersonalization.id, versionId), eq(agentPersonalization.agentId, id))
                )
                .limit(1);

            if (!target) return reply.status(404).send({ error: "Version not found" });

            // Get latest version number
            const [latest] = await db
                .select({ version: agentPersonalization.version })
                .from(agentPersonalization)
                .where(eq(agentPersonalization.agentId, id))
                .orderBy(desc(agentPersonalization.version))
                .limit(1);

            // Create new version from target
            const [rolled] = await db
                .insert(agentPersonalization)
                .values({
                    agentId: id,
                    wizardAnswers: target.wizardAnswers as any,
                    soulMd: target.soulMd,
                    userMd: target.userMd,
                    toolsMd: target.toolsMd,
                    version: (latest?.version ?? 0) + 1,
                })
                .returning();

            return reply.send({ personalization: rolled });
        }
    );
}
