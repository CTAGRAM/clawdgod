// ──────────────────────────────────────────────────────────────
// ClawdGod — Database Schema (Drizzle ORM)
// Matches PRD §7 exactly — 9 core tables + 2 infrastructure tables
// ──────────────────────────────────────────────────────────────

import {
    pgTable,
    uuid,
    text,
    timestamp,
    integer,
    boolean,
    jsonb,
    index,
} from "drizzle-orm/pg-core";

// ── Users ──
export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").unique().notNull(),
    passwordHash: text("password_hash"),
    fullName: text("full_name"),
    googleId: text("google_id").unique(),
    emailVerified: boolean("email_verified").default(false),
    // Trial system — server-side enforced
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
    trialAgentCreated: boolean("trial_agent_created").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Subscriptions ──
export const subscriptions = pgTable("subscriptions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    polarSubscriptionId: text("polar_subscription_id").unique().notNull(),
    polarCustomerId: text("polar_customer_id").notNull(),
    plan: text("plan").notNull(), // 'starter' | 'pro' | 'builder'
    status: text("status").notNull(), // 'active' | 'cancelled' | 'grace_period' | 'expired'
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Agents ──
export const agents = pgTable("agents", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("provisioning"),
    // 'provisioning' | 'active' | 'restarting' | 'offline' | 'stopped'
    openclawVersion: text("openclaw_version").notNull(),
    containerId: text("container_id"),
    nodeId: uuid("node_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Agent AI Providers ──
export const agentAiProviders = pgTable("agent_ai_providers", {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
        .references(() => agents.id, { onDelete: "cascade" })
        .notNull(),
    provider: text("provider").notNull(), // 'anthropic' | 'openai' | 'google' | 'openrouter' | 'custom'
    modelName: text("model_name").notNull(),
    baseUrl: text("base_url"),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    apiKeyIv: text("api_key_iv").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Agent Channels ──
export const agentChannels = pgTable("agent_channels", {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
        .references(() => agents.id, { onDelete: "cascade" })
        .notNull(),
    channelType: text("channel_type").notNull(), // 'telegram' | 'whatsapp' | 'discord'
    status: text("status").notNull().default("connecting"),
    // 'connecting' | 'active' | 'disconnected' | 'error'
    configEncrypted: text("config_encrypted").notNull(),
    configIv: text("config_iv").notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    messageCountToday: integer("message_count_today").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ── Agent Personalization ──
export const agentPersonalization = pgTable("agent_personalization", {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
        .references(() => agents.id, { onDelete: "cascade" })
        .notNull(),
    wizardAnswers: jsonb("wizard_answers").notNull(),
    soulMd: text("soul_md").notNull(),
    userMd: text("user_md").notNull(),
    toolsMd: text("tools_md").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Tasks ──
export const tasks = pgTable(
    "tasks",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        agentId: uuid("agent_id")
            .references(() => agents.id, { onDelete: "cascade" })
            .notNull(),
        externalId: text("external_id").notNull(),
        channelType: text("channel_type"),
        // 'telegram' | 'whatsapp' | 'discord' | 'cron' | 'api'
        status: text("status").notNull().default("queued"),
        // 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
        summary: text("summary"),
        inputPreview: text("input_preview"),
        outputPreview: text("output_preview"),
        steps: jsonb("steps"),
        tokensUsed: integer("tokens_used"),
        durationMs: integer("duration_ms"),
        errorMessage: text("error_message"),
        startedAt: timestamp("started_at", { withTimezone: true }),
        completedAt: timestamp("completed_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    },
    (table) => [
        index("tasks_agent_id_created_at").on(table.agentId, table.createdAt),
        index("tasks_status").on(table.status),
    ]
);

// ── Agent Cron Jobs ──
export const agentCronJobs = pgTable("agent_cron_jobs", {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
        .references(() => agents.id, { onDelete: "cascade" })
        .notNull(),
    name: text("name").notNull(),
    cronExpression: text("cron_expression").notNull(),
    description: text("description"),
    enabled: boolean("enabled").default(true),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: text("last_run_status"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Agent Skills ──
export const agentSkills = pgTable("agent_skills", {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
        .references(() => agents.id, { onDelete: "cascade" })
        .notNull(),
    skillId: text("skill_id").notNull(),
    skillName: text("skill_name").notNull(),
    source: text("source").notNull(), // 'registry' | 'custom'
    safetyScore: integer("safety_score"),
    enabled: boolean("enabled").default(true),
    installedAt: timestamp("installed_at", { withTimezone: true }).defaultNow(),
});

// ── VPS Nodes ──
export const vpsNodes = pgTable("vps_nodes", {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").default("hetzner"),
    region: text("region").notNull(),
    serverId: text("server_id").notNull(),
    ipAddress: text("ip_address").notNull(),
    status: text("status").notNull().default("active"),
    agentCount: integer("agent_count").default(0),
    maxAgents: integer("max_agents").default(4),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Audit Logs ──
export const auditLogs = pgTable("audit_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    agentId: uuid("agent_id").references(() => agents.id),
    action: text("action").notNull(),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
