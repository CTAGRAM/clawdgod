// ──────────────────────────────────────────────────────────────
// ClawdGod — Email Service (Resend)
// Transactional emails: welcome, deploy confirm, trial expiry, etc.
// ──────────────────────────────────────────────────────────────

import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend {
    if (!resend) {
        const key = process.env.RESEND_API_KEY;
        if (!key) throw new Error("RESEND_API_KEY environment variable is required");
        resend = new Resend(key);
    }
    return resend;
}

const FROM = process.env.FROM_EMAIL ?? "hello@clawdgod.io";

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
    await getResend().emails.send({
        from: FROM,
        to,
        subject: "Welcome to ClawdGod! 🚀",
        html: `
      <h1>Welcome to ClawdGod, ${name || "there"}!</h1>
      <p>You're about to deploy your own personalized, secure AI agent.</p>
      <p>Head to your <a href="${process.env.FRONTEND_URL}/dashboard">dashboard</a> to get started with the setup wizard.</p>
      <p>— The ClawdGod Team</p>
    `,
    });
}

export async function sendDeploymentConfirmation(
    to: string,
    agentName: string,
    channels: string[]
): Promise<void> {
    await getResend().emails.send({
        from: FROM,
        to,
        subject: `Your agent "${agentName}" is live! ✅`,
        html: `
      <h1>Your agent is deployed and running!</h1>
      <p><strong>${agentName}</strong> is live on: ${channels.join(", ")}</p>
      <p>Send a message to your agent now and watch it respond in real-time.</p>
      <p>View your <a href="${process.env.FRONTEND_URL}/dashboard">dashboard</a> to track tasks and manage your agent.</p>
    `,
    });
}

export async function sendTrialExpiryWarning(to: string, daysLeft: number): Promise<void> {
    await getResend().emails.send({
        from: FROM,
        to,
        subject: `Your ClawdGod trial ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""} ⏰`,
        html: `
      <h1>Your trial is ending soon</h1>
      <p>Your ClawdGod trial expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.</p>
      <p>Add a payment method to keep your agent running without interruption.</p>
      <p><a href="${process.env.FRONTEND_URL}/dashboard/billing">Update billing →</a></p>
    `,
    });
}

export async function sendPaymentFailedEmail(to: string): Promise<void> {
    await getResend().emails.send({
        from: FROM,
        to,
        subject: "Payment failed — your agent may go offline ⚠️",
        html: `
      <h1>Payment failed</h1>
      <p>We couldn't process your subscription payment. Your agent will continue running for 7 days while you update your billing info.</p>
      <p><a href="${process.env.FRONTEND_URL}/dashboard/billing">Update payment method →</a></p>
    `,
    });
}

export async function sendAgentOfflineAlert(to: string, agentName: string): Promise<void> {
    await getResend().emails.send({
        from: FROM,
        to,
        subject: `Agent "${agentName}" is offline 🔴`,
        html: `
      <h1>Your agent went offline</h1>
      <p><strong>${agentName}</strong> has stopped responding. We're attempting to restart it automatically.</p>
      <p>Check your <a href="${process.env.FRONTEND_URL}/dashboard">dashboard</a> for details.</p>
    `,
    });
}
