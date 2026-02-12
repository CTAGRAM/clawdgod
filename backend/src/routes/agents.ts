// ──────────────────────────────────────────────────────────────
// ClawdGod — Agent Routes
// CRUD + lifecycle management for user agents
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
    agents,
    agentAiProviders,
    agentChannels,
    agentPersonalization,
    subscriptions,
    users,
} from "../db/schema.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { encrypt } from "../lib/encryption.js";
import { generateAllPersonalizationFiles } from "../lib/personalization.js";
import { publishEvent } from "../lib/ably.js";
import { generateOpenClawConfig, buildContainerEnvVars } from "../lib/config-generator.js";
import { PLAN_LIMITS, TRIAL_LIMITS, CONTAINER_DEFAULTS } from "@clawdgod/shared";
import type { WizardAnswers } from "@clawdgod/shared";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "";
const INTERNAL_TOKEN = process.env.INTERNAL_API_SECRET || "";

async function callOrchestrator(path: string, method: string, body?: any) {
    const headers: Record<string, string> = {
        "x-internal-token": INTERNAL_TOKEN,
    };
    if (body) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${ORCHESTRATOR_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Orchestrator ${path}: ${res.status} — ${err}`);
    }
    return res.json();
}

// ── Validation ──
const createAgentSchema = z.object({
    wizardAnswers: z.object({
        agentName: z.string().min(1).max(30),
        channels: z.array(z.enum(["telegram", "whatsapp", "discord"])).min(1),
        aiProvider: z.enum(["anthropic", "openai", "google", "openrouter", "custom"]),
        modelName: z.string().min(1),
        baseUrl: z.string().url().optional(),
        occupation: z.string().min(1),
        topTools: z.array(z.string()),
        helpWith: z.array(z.string()),
        communicationStyle: z.string(),
        timezone: z.string(),
        activePeriod: z.string(),
        biggestFrustration: z.string(),
        mainGoal: z.string(),
        fullName: z.string().optional(),
        company: z.string().optional(),
        keyPeople: z.string().optional(),
        recurringTasks: z.string().optional(),
        enabledCrons: z.array(z.string()).default([]),
    }),
    channelConfigs: z.record(z.record(z.string())),
    apiKey: z.string().min(1),
});

export async function agentRoutes(app: FastifyInstance) {
    // All routes require auth
    app.addHook("preHandler", requireAuth);

    // ── List Agents ──
    app.get("/api/agents", async (request, reply) => {
        const userId = getUserId(request);
        const userAgents = await db
            .select()
            .from(agents)
            .where(eq(agents.userId, userId))
            .orderBy(desc(agents.createdAt));

        return reply.send({ agents: userAgents });
    });

    // ── Get Agent Detail ──
    app.get<{ Params: { id: string } }>("/api/agents/:id", async (request, reply) => {
        const userId = getUserId(request);
        const { id } = request.params;

        const [agent] = await db
            .select()
            .from(agents)
            .where(and(eq(agents.id, id), eq(agents.userId, userId)))
            .limit(1);

        if (!agent) {
            return reply.status(404).send({ error: "Agent not found" });
        }

        // Fetch related data
        const [provider] = await db
            .select({
                provider: agentAiProviders.provider,
                modelName: agentAiProviders.modelName,
                baseUrl: agentAiProviders.baseUrl,
            })
            .from(agentAiProviders)
            .where(eq(agentAiProviders.agentId, id))
            .limit(1);

        const channels = await db
            .select({
                id: agentChannels.id,
                channelType: agentChannels.channelType,
                status: agentChannels.status,
                lastActivityAt: agentChannels.lastActivityAt,
                messageCountToday: agentChannels.messageCountToday,
            })
            .from(agentChannels)
            .where(eq(agentChannels.agentId, id));

        return reply.send({ agent, provider, channels });
    });

    // ── Create Agent (Deploy) ──
    app.post("/api/agents", async (request, reply) => {
        const userId = getUserId(request);
        const parsed = createAgentSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
        }

        const { wizardAnswers, channelConfigs, apiKey } = parsed.data;

        // Check subscription OR trial eligibility
        const [sub] = await db
            .select()
            .from(subscriptions)
            .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
            .limit(1);

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user) return reply.status(401).send({ error: "User not found" });

        const existingAgents = await db
            .select()
            .from(agents)
            .where(eq(agents.userId, userId));

        let isTrial = false;

        if (sub) {
            // ── Paid user: enforce plan limits ──
            const limits = PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS];
            if (existingAgents.length >= limits.maxAgents) {
                return reply.status(403).send({
                    error: `Your ${sub.plan} plan allows ${limits.maxAgents} agent(s). Upgrade to add more.`,
                });
            }
            if (wizardAnswers.channels.length > limits.maxChannels) {
                return reply.status(403).send({
                    error: `Your ${sub.plan} plan allows ${limits.maxChannels} channel(s). Upgrade for more.`,
                });
            }
        } else {
            // ── Trial user: allow exactly 1 agent ──
            if (user.trialAgentCreated) {
                // Check if trial has expired
                const now = new Date();
                if (user.trialExpiresAt && user.trialExpiresAt < now) {
                    return reply.status(403).send({
                        error: "Your trial has expired. Subscribe to continue using ClawdGod.",
                        code: "TRIAL_EXPIRED",
                    });
                }
                return reply.status(403).send({
                    error: "Your trial allows 1 agent. Subscribe to create more.",
                    code: "TRIAL_LIMIT",
                });
            }
            if (existingAgents.length >= TRIAL_LIMITS.maxAgents) {
                return reply.status(403).send({
                    error: "Your trial allows 1 agent. Subscribe to create more.",
                    code: "TRIAL_LIMIT",
                });
            }
            if (wizardAnswers.channels.length > TRIAL_LIMITS.maxChannels) {
                return reply.status(403).send({
                    error: "Your trial allows 1 channel. Subscribe for more.",
                    code: "TRIAL_LIMIT",
                });
            }
            isTrial = true;
        }

        // 1. Create agent record
        const [agent] = await db
            .insert(agents)
            .values({
                userId,
                name: wizardAnswers.agentName,
                status: "provisioning",
                openclawVersion: CONTAINER_DEFAULTS.openclawVersion,
            })
            .returning();

        // 2. Encrypt & store API key
        const encryptedKey = encrypt(apiKey);
        await db.insert(agentAiProviders).values({
            agentId: agent.id,
            provider: wizardAnswers.aiProvider,
            modelName: wizardAnswers.modelName,
            baseUrl: wizardAnswers.baseUrl ?? null,
            apiKeyEncrypted: encryptedKey.ciphertext,
            apiKeyIv: encryptedKey.iv,
        });

        // 3. Encrypt & store channel configs
        for (const channelType of wizardAnswers.channels) {
            const config = channelConfigs[channelType] ?? {};
            const encryptedConfig = encrypt(JSON.stringify(config));
            await db.insert(agentChannels).values({
                agentId: agent.id,
                channelType,
                status: "connecting",
                configEncrypted: encryptedConfig.ciphertext,
                configIv: encryptedConfig.iv,
            });
        }

        // 4. Generate personalization files using user's own AI key
        let soulMd = `# ${wizardAnswers.agentName || "Agent"}\nYou are a helpful AI assistant.`;
        let userMd = `# User Profile\nOccupation: ${wizardAnswers.occupation || "Not specified"}`;
        let toolsMd = "# Tools\nNo special tools configured.";

        try {
            const generated = await generateAllPersonalizationFiles(
                wizardAnswers as WizardAnswers,
                {
                    provider: wizardAnswers.aiProvider as any,
                    apiKey,
                    modelName: wizardAnswers.modelName,
                }
            );
            soulMd = generated.soulMd;
            userMd = generated.userMd;
            toolsMd = generated.toolsMd;
        } catch (personalizationError) {
            app.log.warn({ err: personalizationError, agentId: agent.id }, "Personalization generation failed — using defaults");
        }

        await db.insert(agentPersonalization).values({
            agentId: agent.id,
            wizardAnswers: wizardAnswers as any,
            soulMd,
            userMd,
            toolsMd,
            version: 1,
        });

        // 5. Publish provisioning event
        await publishEvent(agent.id, userId, "agent.status", {
            status: "provisioning",
            message: "Generating personalization files…",
        });

        // 6. Call orchestrator to create container (fire-and-forget)
        const configJson = generateOpenClawConfig(
            agent.id,
            wizardAnswers as WizardAnswers,
            channelConfigs,
            apiKey
        );

        const containerFiles = [
            { path: "SOUL.md", content: soulMd },
            { path: "USER.md", content: userMd },
            { path: "TOOLS.md", content: toolsMd },
            { path: "config.json", content: configJson },
        ];

        const envVars = buildContainerEnvVars(wizardAnswers as WizardAnswers, apiKey);

        // If orchestrator is configured, fire-and-forget container creation
        if (ORCHESTRATOR_URL) {
            callOrchestrator("/internal/containers/create", "POST", {
                agentId: agent.id,
                userId,
                openclawVersion: CONTAINER_DEFAULTS.openclawVersion,
                envVars,
                files: containerFiles,
                channels: wizardAnswers.channels,
                enableWhatsappSidecar: wizardAnswers.channels.includes("whatsapp"),
            }).catch((err) => {
                app.log.error(err, `Container creation failed for agent ${agent.id}`);
            });
        } else {
            // No orchestrator: immediately mark agent as active
            app.log.info(`No ORCHESTRATOR_URL set — marking agent ${agent.id} as active (standalone mode)`);
            await db
                .update(agents)
                .set({ status: "active", updatedAt: new Date() })
                .where(eq(agents.id, agent.id));
            await publishEvent(agent.id, userId, "agent.status", {
                status: "active",
                message: "Agent is active (standalone mode)",
            });
        }

        // 7. If trial user, set trial timestamps (starts the 1-hour clock)
        try {
            if (isTrial) {
                const now = new Date();
                const expiresAt = new Date(now.getTime() + TRIAL_LIMITS.trialDurationMs);
                await db
                    .update(users)
                    .set({
                        trialStartedAt: now,
                        trialExpiresAt: expiresAt,
                        trialAgentCreated: true,
                        updatedAt: now,
                    })
                    .where(eq(users.id, userId));
                app.log.info({ userId, expiresAt }, "Trial started");
            }
        } catch (trialErr) {
            app.log.warn({ err: trialErr, userId }, "Trial timestamp update failed — non-blocking");
        }

        return reply.status(201).send({
            agent: { id: agent.id, name: agent.name, status: agent.status },
            personalization: { soulMd, userMd, toolsMd },
        });
    });

    // ── Delete Agent ──
    app.delete<{ Params: { id: string } }>("/api/agents/:id", async (request, reply) => {
        const userId = getUserId(request);
        const { id } = request.params;

        const [agent] = await db
            .select()
            .from(agents)
            .where(and(eq(agents.id, id), eq(agents.userId, userId)))
            .limit(1);

        if (!agent) {
            return reply.status(404).send({ error: "Agent not found" });
        }

        // Call orchestrator to delete container (if configured)
        if (ORCHESTRATOR_URL) {
            callOrchestrator(`/internal/containers/${id}`, "DELETE").catch((err) => {
                app.log.error(err, `Container deletion failed for agent ${id}`);
            });
        }

        await db.delete(agents).where(eq(agents.id, id));

        return reply.send({ success: true });
    });

    // ── Restart Agent ──
    app.post<{ Params: { id: string } }>("/api/agents/:id/restart", async (request, reply) => {
        const userId = getUserId(request);
        const { id } = request.params;

        const [agent] = await db
            .select()
            .from(agents)
            .where(and(eq(agents.id, id), eq(agents.userId, userId)))
            .limit(1);

        if (!agent) {
            return reply.status(404).send({ error: "Agent not found" });
        }

        await db
            .update(agents)
            .set({ status: "restarting", updatedAt: new Date() })
            .where(eq(agents.id, id));

        await publishEvent(id, userId, "agent.status", { status: "restarting" });

        // Call orchestrator to restart container (if configured)
        if (ORCHESTRATOR_URL) {
            callOrchestrator(`/internal/containers/${id}/restart`, "POST").catch((err) => {
                app.log.error(err, `Container restart failed for agent ${id}`);
            });
        } else {
            // No orchestrator: just set back to active
            await db
                .update(agents)
                .set({ status: "active", updatedAt: new Date() })
                .where(eq(agents.id, id));
            await publishEvent(id, userId, "agent.status", { status: "active" });
        }

        return reply.send({ success: true, status: "restarting" });
    });

    // ── Trial Status ──
    app.get("/api/agents/trial-status", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = getUserId(request);

        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user) return reply.status(401).send({ error: "User not found" });

        const [sub] = await db
            .select()
            .from(subscriptions)
            .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
            .limit(1);

        const now = new Date();
        const hasSubscription = !!sub;
        const isTrial = !hasSubscription && !!user.trialAgentCreated;
        const trialExpired = isTrial && user.trialExpiresAt ? user.trialExpiresAt < now : false;
        const deletionAt = user.trialExpiresAt
            ? new Date(user.trialExpiresAt.getTime() + TRIAL_LIMITS.deletionGracePeriodMs)
            : null;

        return reply.send({
            isTrial,
            hasSubscription,
            trialStartedAt: user.trialStartedAt?.toISOString() ?? null,
            trialExpiresAt: user.trialExpiresAt?.toISOString() ?? null,
            trialExpired,
            deletionAt: deletionAt?.toISOString() ?? null,
            trialAgentCreated: user.trialAgentCreated ?? false,
        });
    });
}
