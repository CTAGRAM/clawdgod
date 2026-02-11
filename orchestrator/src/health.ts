// ──────────────────────────────────────────────────────────────
// ClawdGod — Agent Health Check Loop
// Checks all agents every 60s, auto-restarts on failure
// ──────────────────────────────────────────────────────────────

import { isAgentRunning, restartAgent } from "./containers.js";
import type { SSHConfig } from "./ssh.js";

const HEALTH_CHECK_INTERVAL_MS = 60_000;
const MAX_FAILS = 3;

interface TrackedAgent {
    agentId: string;
    nodeIp: string;
    failCount: number;
}

const trackedAgents = new Map<string, TrackedAgent>();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const INTERNAL_TOKEN = process.env.INTERNAL_API_SECRET || "";

/**
 * Register an agent for health monitoring.
 */
export function trackAgent(agentId: string, nodeIp: string) {
    trackedAgents.set(agentId, { agentId, nodeIp, failCount: 0 });
}

/**
 * Unregister an agent from health monitoring.
 */
export function untrackAgent(agentId: string) {
    trackedAgents.delete(agentId);
}

/**
 * Run one health check cycle for all tracked agents.
 */
async function healthCheckCycle() {
    for (const [agentId, agent] of trackedAgents) {
        try {
            const ssh: SSHConfig = { host: agent.nodeIp };
            const running = await isAgentRunning(ssh, agentId);

            if (running) {
                agent.failCount = 0;
            } else {
                agent.failCount++;
                console.warn(
                    `[Health] Agent ${agentId} not running (fail count: ${agent.failCount})`
                );

                if (agent.failCount >= MAX_FAILS) {
                    console.error(`[Health] Agent ${agentId} exceeded max fails, restarting`);
                    try {
                        await restartAgent(ssh, agentId);
                        agent.failCount = 0;
                    } catch (err) {
                        console.error(`[Health] Failed to restart ${agentId}:`, err);
                        await notifyOffline(agentId);
                    }
                }
            }
        } catch (err) {
            console.error(`[Health] Error checking ${agentId}:`, err);
            agent.failCount++;
        }
    }
}

async function notifyOffline(agentId: string) {
    try {
        await fetch(`${BACKEND_URL}/internal/agents/${agentId}/status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-token": INTERNAL_TOKEN,
            },
            body: JSON.stringify({ status: "offline" }),
        });
    } catch {
        // silently fail
    }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the health check loop.
 */
export function startHealthChecks() {
    if (intervalId) return;
    console.log(`[Health] Starting health checks every ${HEALTH_CHECK_INTERVAL_MS / 1000}s`);
    intervalId = setInterval(healthCheckCycle, HEALTH_CHECK_INTERVAL_MS);
}

/**
 * Stop the health check loop.
 */
export function stopHealthChecks() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}
