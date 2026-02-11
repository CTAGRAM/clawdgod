// ──────────────────────────────────────────────────────────────
// ClawdGod — Redis Client (Upstash)
// Used for JWT blacklist, rate limiting state, and BullMQ queue
// ──────────────────────────────────────────────────────────────

import IORedis from "ioredis";

let redis: IORedis | null = null;

export function getRedis(): IORedis {
    if (!redis) {
        const url = process.env.UPSTASH_REDIS_URL;
        if (!url) {
            throw new Error("UPSTASH_REDIS_URL environment variable is required");
        }
        redis = new IORedis(url, {
            maxRetriesPerRequest: null, // required for BullMQ
            enableReadyCheck: false,
            tls: url.startsWith("rediss://") ? {} : undefined,
        });
    }
    return redis;
}

/**
 * Add a JWT token ID to the blacklist (on logout/revocation).
 * TTL matches the token's remaining lifetime.
 */
export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await getRedis().setex(`bl:${jti}`, ttlSeconds, "1");
}

/**
 * Check if a JWT token ID has been blacklisted.
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await getRedis().get(`bl:${jti}`);
    return result !== null;
}
