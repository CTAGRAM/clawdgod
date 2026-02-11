// ──────────────────────────────────────────────────────────────
// ClawdGod — Billing Routes (Polar.sh)
// Checkout session, webhook handler, billing portal
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db/client.js";
import { subscriptions, users, agents } from "../db/schema.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import {
    sendWelcomeEmail,
    sendPaymentFailedEmail,
} from "../lib/email.js";

const checkoutSchema = z.object({
    plan: z.enum(["starter", "pro", "builder"]),
});

// Map plan to Polar product IDs (set via env vars)
function getPolarProductId(plan: string): string {
    const map: Record<string, string | undefined> = {
        starter: process.env.POLAR_STARTER_PRODUCT_ID,
        pro: process.env.POLAR_PRO_PRODUCT_ID,
        builder: process.env.POLAR_BUILDER_PRODUCT_ID,
    };
    const id = map[plan];
    if (!id) throw new Error(`No Polar product ID configured for plan: ${plan}`);
    return id;
}

export async function billingRoutes(app: FastifyInstance) {
    // ── Create Checkout Session ──
    app.post(
        "/api/billing/checkout",
        { preHandler: [requireAuth] },
        async (request, reply) => {
            const userId = getUserId(request);
            const parsed = checkoutSchema.safeParse(request.body);
            if (!parsed.success) {
                return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
            }

            const productId = getPolarProductId(parsed.data.plan);
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

            // Call Polar API to create checkout session
            const polarToken = process.env.POLAR_ACCESS_TOKEN;
            const response = await fetch("https://api.polar.sh/v1/checkouts/", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${polarToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    products: [productId],
                    success_url: `${frontendUrl}/dashboard/agents/new?checkout=success`,
                    metadata: { clawdgod_user_id: userId },
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                return reply.status(502).send({ error: "Failed to create checkout", detail: err });
            }

            const checkout = await response.json();
            return reply.send({ checkoutUrl: checkout.url });
        }
    );

    // ── Get Subscription ──
    app.get(
        "/api/billing/subscription",
        { preHandler: [requireAuth] },
        async (request, reply) => {
            const userId = getUserId(request);
            const [sub] = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, userId))
                .limit(1);

            return reply.send({ subscription: sub || null });
        }
    );

    // ── Polar Webhook ──
    app.post("/api/webhooks/polar", {
        config: { rawBody: true },
    }, async (request, reply) => {
        const secret = process.env.POLAR_WEBHOOK_SECRET;

        if (secret) {
            // Polar uses Svix for webhooks — verify HMAC-SHA256 signature
            const webhookId = request.headers["webhook-id"] as string;
            const webhookTimestamp = request.headers["webhook-timestamp"] as string;
            const webhookSignature = request.headers["webhook-signature"] as string;

            if (!webhookId || !webhookTimestamp || !webhookSignature) {
                return reply.status(401).send({ error: "Missing webhook headers" });
            }

            // Prevent replay: reject if timestamp is older than 5 minutes
            const ts = parseInt(webhookTimestamp);
            const now = Math.floor(Date.now() / 1000);
            if (Math.abs(now - ts) > 300) {
                return reply.status(401).send({ error: "Webhook timestamp too old" });
            }

            // Compute expected signature
            const rawBody = typeof request.body === "string"
                ? request.body
                : JSON.stringify(request.body);
            const toSign = `${webhookId}.${webhookTimestamp}.${rawBody}`;
            // Polar/Svix secret is base64-encoded, prefixed with "whsec_"
            const secretBytes = Buffer.from(
                secret.startsWith("whsec_") ? secret.slice(6) : secret,
                "base64"
            );
            const expected = createHmac("sha256", secretBytes)
                .update(toSign)
                .digest("base64");

            // Webhook-Signature can have multiple space-separated entries like "v1,<sig>"
            const signatures = webhookSignature.split(" ");
            const valid = signatures.some((s) => {
                const [version, sig] = s.split(",");
                if (version !== "v1" || !sig) return false;
                try {
                    return timingSafeEqual(
                        Buffer.from(expected),
                        Buffer.from(sig)
                    );
                } catch {
                    return false;
                }
            });

            if (!valid) {
                app.log.warn("Polar webhook signature mismatch");
                return reply.status(401).send({ error: "Invalid signature" });
            }
        } else {
            app.log.warn("POLAR_WEBHOOK_SECRET not set — accepting webhook without verification");
        }

        const body = request.body as any;
        const eventType = body.type || body.event;

        app.log.info({ eventType }, "Polar webhook received");

        switch (eventType) {
            case "subscription.created": {
                const data = body.data;
                const userId = data.metadata?.clawdgod_user_id || data.customer_metadata?.clawdgod_user_id;
                if (!userId) {
                    app.log.warn("subscription.created missing clawdgod_user_id");
                    break;
                }

                // Detect plan from product ID (reverse the product ID map)
                const productId = data.product_id || data.product?.id;
                const planMap: Record<string, string> = {};
                if (process.env.POLAR_STARTER_PRODUCT_ID) planMap[process.env.POLAR_STARTER_PRODUCT_ID] = "starter";
                if (process.env.POLAR_PRO_PRODUCT_ID) planMap[process.env.POLAR_PRO_PRODUCT_ID] = "pro";
                if (process.env.POLAR_BUILDER_PRODUCT_ID) planMap[process.env.POLAR_BUILDER_PRODUCT_ID] = "builder";
                const plan = planMap[productId] || "starter";

                await db.insert(subscriptions).values({
                    userId,
                    polarSubscriptionId: data.id,
                    polarCustomerId: data.customer_id,
                    plan,
                    status: "active",
                    currentPeriodStart: new Date(data.current_period_start),
                    currentPeriodEnd: new Date(data.current_period_end),
                });

                // Send welcome email
                const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
                if (user) {
                    await sendWelcomeEmail(user.email, user.fullName || "");
                }
                break;
            }

            case "subscription.renewed": {
                const data = body.data;
                await db
                    .update(subscriptions)
                    .set({
                        status: "active",
                        currentPeriodStart: new Date(data.current_period_start),
                        currentPeriodEnd: new Date(data.current_period_end),
                        updatedAt: new Date(),
                    })
                    .where(eq(subscriptions.polarSubscriptionId, data.id));
                break;
            }

            case "subscription.cancelled": {
                const data = body.data;
                await db
                    .update(subscriptions)
                    .set({
                        status: "cancelled",
                        cancelledAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(subscriptions.polarSubscriptionId, data.id));
                break;
            }

            case "payment.failed": {
                const data = body.data;
                const [sub] = await db
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.polarCustomerId, data.customer_id))
                    .limit(1);

                if (sub) {
                    await db
                        .update(subscriptions)
                        .set({ status: "grace_period", updatedAt: new Date() })
                        .where(eq(subscriptions.id, sub.id));

                    const [user] = await db
                        .select()
                        .from(users)
                        .where(eq(users.id, sub.userId))
                        .limit(1);
                    if (user) {
                        await sendPaymentFailedEmail(user.email);
                    }
                }
                break;
            }

            case "payment.recovered": {
                const data = body.data;
                await db
                    .update(subscriptions)
                    .set({ status: "active", updatedAt: new Date() })
                    .where(eq(subscriptions.polarCustomerId, data.customer_id));
                break;
            }

            default:
                app.log.info({ eventType }, "Unhandled Polar webhook event");
        }

        return reply.send({ received: true });
    });
}
