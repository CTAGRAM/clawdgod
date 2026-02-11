// ──────────────────────────────────────────────────────────────
// ClawdGod — Auth Middleware
// JWT verification + resource ownership checks
// ──────────────────────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from "fastify";
import { isTokenBlacklisted } from "../lib/redis.js";

export interface JWTPayload {
    sub: string; // user ID
    email: string;
    jti: string; // token ID for blacklisting
    iat: number;
    exp: number;
}

/**
 * Middleware: Verify JWT access token.
 * Attaches decoded user to request.
 */
export async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        const decoded = await request.jwtVerify<JWTPayload>();

        // Check blacklist
        if (await isTokenBlacklisted(decoded.jti)) {
            return reply.status(401).send({ error: "Token has been revoked" });
        }

        // Attach user info to request
        (request as any).userId = decoded.sub;
        (request as any).userEmail = decoded.email;
    } catch {
        return reply.status(401).send({ error: "Invalid or expired token" });
    }
}

/**
 * Helper to get authenticated user ID from request.
 */
export function getUserId(request: FastifyRequest): string {
    return (request as any).userId;
}
