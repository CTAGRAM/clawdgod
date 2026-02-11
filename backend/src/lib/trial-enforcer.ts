// ──────────────────────────────────────────────────────────────
// ClawdGod — Trial Enforcer (Server-side cron)
// Runs every 60s. Pauses expired trials, deletes abandoned accounts.
// All enforcement is server-side — the frontend cannot bypass this.
// ──────────────────────────────────────────────────────────────

import { eq, and, lt, isNull, isNotNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, agents, subscriptions } from "../db/schema.js";
import { TRIAL_LIMITS } from "@clawdgod/shared";
import { sendTrialExpiryWarning } from "./email.js";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:3002";
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
    return res;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * 1. Pause expired trial agents (trial ended, no subscription)
 * 2. Delete abandoned accounts (trial ended 24h+ ago, no subscription)
 */
async function enforceTrials() {
    const now = new Date();

    try {
        // ── Step 1: Find expired trial users without a subscription ──
        const expiredTrialUsers = await db
            .select({
                id: users.id,
                email: users.email,
                trialExpiresAt: users.trialExpiresAt,
            })
            .from(users)
            .where(
                and(
                    isNotNull(users.trialExpiresAt),
                    lt(users.trialExpiresAt, now),
                    eq(users.trialAgentCreated, true)
                )
            );

        for (const user of expiredTrialUsers) {
            // Check if user now has an active subscription (they paid!)
            const [sub] = await db
                .select()
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.userId, user.id),
                        eq(subscriptions.status, "active")
                    )
                )
                .limit(1);

            if (sub) {
                // User paid — clear trial flags so they're no longer treated as trial
                await db
                    .update(users)
                    .set({
                        trialStartedAt: null,
                        trialExpiresAt: null,
                        trialAgentCreated: false,
                        updatedAt: now,
                    })
                    .where(eq(users.id, user.id));
                continue;
            }

            // Calculate deletion deadline
            const deletionDeadline = new Date(
                user.trialExpiresAt!.getTime() + TRIAL_LIMITS.deletionGracePeriodMs
            );

            if (now >= deletionDeadline) {
                // ── Step 2: Delete abandoned account (24h past trial expiry) ──
                console.log(`[trial-enforcer] Deleting abandoned account: ${user.id} (${user.email})`);

                // Get user's agents and delete them from VPS
                const userAgents = await db
                    .select()
                    .from(agents)
                    .where(eq(agents.userId, user.id));

                for (const agent of userAgents) {
                    try {
                        await callOrchestrator(`/internal/containers/${agent.id}`, "DELETE");
                    } catch (err) {
                        console.error(`[trial-enforcer] Failed to delete container for agent ${agent.id}:`, err);
                    }
                }

                // Delete user (cascade deletes agents, channels, etc.)
                await db.delete(users).where(eq(users.id, user.id));
                console.log(`[trial-enforcer] Account ${user.id} deleted`);
            } else {
                // ── Trial expired but within grace period: stop agents ──
                const userAgents = await db
                    .select()
                    .from(agents)
                    .where(
                        and(
                            eq(agents.userId, user.id),
                            // Only stop agents that are still running
                            eq(agents.status, "active")
                        )
                    );

                for (const agent of userAgents) {
                    console.log(`[trial-enforcer] Stopping trial agent: ${agent.id}`);
                    try {
                        await callOrchestrator(`/internal/containers/${agent.id}/stop`, "POST");
                    } catch {
                        // Fallback: try delete
                        try {
                            await callOrchestrator(`/internal/containers/${agent.id}`, "DELETE");
                        } catch (err) {
                            console.error(`[trial-enforcer] Failed to stop agent ${agent.id}:`, err);
                        }
                    }
                    await db
                        .update(agents)
                        .set({ status: "stopped", updatedAt: now })
                        .where(eq(agents.id, agent.id));
                }

                // Send expiry email (only once — check if agent was just stopped)
                if (userAgents.length > 0) {
                    try {
                        await sendTrialExpiryWarning(user.email, 0);
                    } catch (err) {
                        console.error(`[trial-enforcer] Failed to send expiry email:`, err);
                    }
                }
            }
        }
    } catch (err) {
        console.error("[trial-enforcer] Enforcement cycle error:", err);
    }
}

/**
 * Start the trial enforcement cron (runs every 60 seconds)
 */
export function startTrialEnforcer() {
    console.log("[trial-enforcer] Started (60s interval)");
    // Run immediately on startup
    enforceTrials();
    // Then every 60 seconds
    intervalHandle = setInterval(enforceTrials, 60_000);
}

/**
 * Stop the trial enforcement cron (for graceful shutdown)
 */
export function stopTrialEnforcer() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log("[trial-enforcer] Stopped");
    }
}
