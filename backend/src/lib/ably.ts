// ──────────────────────────────────────────────────────────────
// ClawdGod — Ably Real-time Push (Server-side)
// Publishes task events, agent status, and channel status updates
// ──────────────────────────────────────────────────────────────

import Ably from "ably";

let ably: Ably.Rest | null = null;

function getAbly(): Ably.Rest {
    if (!ably) {
        const key = process.env.ABLY_API_KEY;
        if (!key) throw new Error("ABLY_API_KEY environment variable is required");
        ably = new Ably.Rest({ key });
    }
    return ably;
}

/**
 * Get the private Ably channel name for a user's agent.
 * Format: agent:{agentId}:{userId}
 */
function getChannelName(agentId: string, userId: string): string {
    return `agent:${agentId}:${userId}`;
}

/**
 * Publish an event to a user's agent channel.
 */
export async function publishEvent(
    agentId: string,
    userId: string,
    eventName: string,
    data: unknown
): Promise<void> {
    const channel = getAbly().channels.get(getChannelName(agentId, userId));
    await channel.publish(eventName, data);
}

/**
 * Create a token request for client-side Ably authentication.
 * The client can only subscribe to their own agent channels.
 */
export async function createTokenRequest(
    agentId: string,
    userId: string
): Promise<Ably.TokenRequest> {
    const channelName = getChannelName(agentId, userId);
    return getAbly().auth.createTokenRequest({
        capability: { [channelName]: ["subscribe"] },
    });
}
