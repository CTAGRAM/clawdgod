// ──────────────────────────────────────────────────────────────
// ClawdGod — Auth Routes
// POST /api/auth/register, /login, /google, /logout, /refresh
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { blacklistToken, getRedis } from "../lib/redis.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import type { JWTPayload } from "../middleware/auth.js";

// ── Validation Schemas ──
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(1).max(100),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

// ── Helpers ──
function generateTokens(app: FastifyInstance, user: { id: string; email: string }) {
    const jti = randomUUID();
    const accessToken = app.jwt.sign(
        { sub: user.id, email: user.email, jti },
        { expiresIn: "15m" }
    );
    const refreshJti = randomUUID();
    const refreshToken = app.jwt.sign(
        { sub: user.id, email: user.email, jti: refreshJti, type: "refresh" },
        { expiresIn: "7d" }
    );
    return { accessToken, refreshToken, refreshJti };
}

export async function authRoutes(app: FastifyInstance) {
    // ── Register ──
    app.post("/api/auth/register", async (request, reply) => {
        const parsed = registerSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
        }

        const { email, password, fullName } = parsed.data;

        // Check if user exists
        const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existing.length > 0) {
            return reply.status(409).send({ error: "Email already registered" });
        }

        // Create user
        const passwordHash = await hash(password, 12);
        const [newUser] = await db
            .insert(users)
            .values({ email, passwordHash, fullName })
            .returning({ id: users.id, email: users.email, fullName: users.fullName });

        const { accessToken, refreshToken } = generateTokens(app, newUser);

        reply
            .setCookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/api/auth/refresh",
                maxAge: 7 * 24 * 60 * 60, // 7 days
            })
            .status(201)
            .send({
                accessToken,
                user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName },
            });
    });

    // ── Login ──
    app.post("/api/auth/login", async (request, reply) => {
        const parsed = loginSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
        }

        const { email, password } = parsed.data;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user || !user.passwordHash) {
            return reply.status(401).send({ error: "Invalid email or password" });
        }

        const valid = await compare(password, user.passwordHash);
        if (!valid) {
            return reply.status(401).send({ error: "Invalid email or password" });
        }

        const { accessToken, refreshToken } = generateTokens(app, {
            id: user.id!,
            email: user.email,
        });

        reply
            .setCookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/api/auth/refresh",
                maxAge: 7 * 24 * 60 * 60,
            })
            .send({
                accessToken,
                user: { id: user.id, email: user.email, fullName: user.fullName },
            });
    });

    // ── Google OAuth ──
    const googleAuthSchema = z.object({
        credential: z.string().min(1, "Google credential is required"),
    });

    app.post("/api/auth/google", async (request, reply) => {
        const parsed = googleAuthSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
        }

        const { credential } = parsed.data;

        try {
            // Verify Google ID token via Google's tokeninfo endpoint
            const tokenRes = await fetch(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
            );

            if (!tokenRes.ok) {
                return reply.status(401).send({ error: "Invalid Google token" });
            }

            const googleUser = (await tokenRes.json()) as {
                sub: string;      // Google user ID
                email: string;
                name?: string;
                email_verified?: string;
            };

            if (!googleUser.email || !googleUser.sub) {
                return reply.status(401).send({ error: "Invalid Google token payload" });
            }

            // Check if user exists by Google ID
            let [existingUser] = await db
                .select()
                .from(users)
                .where(eq(users.googleId, googleUser.sub))
                .limit(1);

            // If no match by Google ID, check by email (link accounts)
            if (!existingUser) {
                [existingUser] = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, googleUser.email))
                    .limit(1);

                if (existingUser) {
                    // Link existing email account to Google
                    await db
                        .update(users)
                        .set({ googleId: googleUser.sub })
                        .where(eq(users.id, existingUser.id!));
                }
            }

            // Create new user if needed
            if (!existingUser) {
                const [newUser] = await db
                    .insert(users)
                    .values({
                        email: googleUser.email,
                        fullName: googleUser.name || googleUser.email.split("@")[0],
                        googleId: googleUser.sub,
                        // No password — Google-only account
                    })
                    .returning({ id: users.id, email: users.email, fullName: users.fullName });
                existingUser = newUser as any;
            }

            const { accessToken, refreshToken } = generateTokens(app, {
                id: existingUser.id!,
                email: existingUser.email,
            });

            reply
                .setCookie("refreshToken", refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    path: "/api/auth/refresh",
                    maxAge: 7 * 24 * 60 * 60,
                })
                .send({
                    accessToken,
                    user: {
                        id: existingUser.id,
                        email: existingUser.email,
                        fullName: existingUser.fullName,
                    },
                });
        } catch (err: any) {
            request.log.error(err, "Google auth failed");
            return reply.status(500).send({ error: "Google authentication failed" });
        }
    });

    // ── Refresh Token ──
    app.post("/api/auth/refresh", async (request, reply) => {
        const token = request.cookies.refreshToken;
        if (!token) {
            return reply.status(401).send({ error: "No refresh token" });
        }

        try {
            const decoded = app.jwt.verify<JWTPayload & { type: string }>(token);
            if (decoded.type !== "refresh") {
                return reply.status(401).send({ error: "Invalid token type" });
            }

            // Blacklist old refresh token (rotation)
            await blacklistToken(decoded.jti, 7 * 24 * 60 * 60);

            // Issue new tokens
            const { accessToken, refreshToken: newRefreshToken } = generateTokens(app, {
                id: decoded.sub,
                email: decoded.email,
            });

            reply
                .setCookie("refreshToken", newRefreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    path: "/api/auth/refresh",
                    maxAge: 7 * 24 * 60 * 60,
                })
                .send({ accessToken });
        } catch {
            return reply.status(401).send({ error: "Invalid refresh token" });
        }
    });

    // ── Logout ──
    app.post("/api/auth/logout", { preHandler: [requireAuth] }, async (request, reply) => {
        try {
            const decoded = await request.jwtVerify<JWTPayload>();
            // Blacklist the access token for its remaining lifetime
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
                await blacklistToken(decoded.jti, ttl);
            }
        } catch {
            // Token already expired, that's fine
        }

        reply
            .clearCookie("refreshToken", { path: "/api/auth/refresh" })
            .send({ success: true });
    });

    // ── Get Current User ──
    app.get("/api/auth/me", { preHandler: [requireAuth] }, async (request, reply) => {
        const userId = getUserId(request);
        const [user] = await db
            .select({
                id: users.id,
                email: users.email,
                fullName: users.fullName,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return reply.status(404).send({ error: "User not found" });
        }
        return reply.send({ user });
    });
}
