// ──────────────────────────────────────────────────────────────
// ClawdGod — Shared Types
// ──────────────────────────────────────────────────────────────

// ── User ──
export interface User {
    id: string;
    email: string;
    fullName: string | null;
    googleId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// ── Subscription ──
export type PlanType = "starter" | "pro" | "builder";
export type SubscriptionStatus = "active" | "cancelled" | "grace_period" | "expired";

export interface Subscription {
    id: string;
    userId: string;
    polarSubscriptionId: string;
    polarCustomerId: string;
    plan: PlanType;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelledAt: Date | null;
}

// ── Agent ──
export type AgentStatus = "provisioning" | "active" | "restarting" | "offline" | "stopped";

export interface Agent {
    id: string;
    userId: string;
    name: string;
    status: AgentStatus;
    openclawVersion: string;
    containerId: string | null;
    nodeId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// ── AI Provider ──
export type AIProvider = "anthropic" | "openai" | "google" | "openrouter" | "custom";

export interface AgentAIProvider {
    id: string;
    agentId: string;
    provider: AIProvider;
    modelName: string;
    baseUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// ── Channels ──
export type ChannelType = "telegram" | "whatsapp" | "discord";
export type ChannelStatus = "connecting" | "active" | "disconnected" | "error";

export interface AgentChannel {
    id: string;
    agentId: string;
    channelType: ChannelType;
    status: ChannelStatus;
    lastActivityAt: Date | null;
    messageCountToday: number;
    createdAt: Date;
    updatedAt: Date;
}

// ── Tasks ──
export type TaskStatus = "queued" | "in_progress" | "completed" | "failed" | "cancelled";
export type TaskChannelType = ChannelType | "cron" | "api";

export interface TaskStep {
    type: string;
    input: string;
    output: string;
    timestamp: string;
}

export interface Task {
    id: string;
    agentId: string;
    externalId: string;
    channelType: TaskChannelType | null;
    status: TaskStatus;
    summary: string | null;
    inputPreview: string | null;
    outputPreview: string | null;
    steps: TaskStep[] | null;
    tokensUsed: number | null;
    durationMs: number | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
}

// ── Personalization ──
export interface AgentPersonalization {
    id: string;
    agentId: string;
    wizardAnswers: WizardAnswers;
    soulMd: string;
    userMd: string;
    toolsMd: string;
    version: number;
    createdAt: Date;
}

export interface WizardAnswers {
    agentName: string;
    setupMode: 'basic' | 'full';
    channels: ChannelType[];
    aiProvider: AIProvider;
    modelName: string;
    baseUrl?: string;
    // Tools (Full setup)
    enabledTools: string[];
    toolApiKeys: Record<string, string>;
    // Skills (Full setup)
    enabledSkills: string[];
    // Personalization (Steps 8-10)
    occupation: string;
    topTools: string[];
    helpWith: string[];
    communicationStyle: string;
    timezone: string;
    activePeriod: string;
    biggestFrustration: string;
    mainGoal: string;
    fullName?: string;
    company?: string;
    keyPeople?: string;
    recurringTasks?: string;
    // Cron (Step 11)
    enabledCrons: string[];
}

// ── Cron Jobs ──
export interface AgentCronJob {
    id: string;
    agentId: string;
    name: string;
    cronExpression: string;
    description: string | null;
    enabled: boolean;
    nextRunAt: Date | null;
    lastRunAt: Date | null;
    lastRunStatus: string | null;
    createdAt: Date;
}

// ── Skills ──
export type SkillSource = "registry" | "custom";

export interface AgentSkill {
    id: string;
    agentId: string;
    skillId: string;
    skillName: string;
    source: SkillSource;
    safetyScore: number | null;
    enabled: boolean;
    installedAt: Date;
}

// ── VPS Nodes ──
export interface VPSNode {
    id: string;
    provider: string;
    region: string;
    serverId: string;
    ipAddress: string;
    status: string;
    agentCount: number;
    maxAgents: number;
    createdAt: Date;
}

// ── Audit Log ──
export interface AuditLog {
    id: string;
    userId: string | null;
    agentId: string | null;
    action: string;
    metadata: Record<string, unknown> | null;
    ipAddress: string | null;
    createdAt: Date;
}

// ── API Request/Response types ──
export interface AuthRegisterRequest {
    email: string;
    password: string;
    fullName: string;
}

export interface AuthLoginRequest {
    email: string;
    password: string;
}

export interface AuthTokenResponse {
    accessToken: string;
    user: Pick<User, "id" | "email" | "fullName">;
}

export interface CreateAgentRequest {
    wizardAnswers: WizardAnswers;
    channelConfigs: Record<ChannelType, Record<string, string>>;
    apiKey: string;
}

export interface AgentStatusResponse {
    agentId: string;
    status: AgentStatus;
    channels: { type: ChannelType; status: ChannelStatus }[];
    uptime: number | null;
}

// ── Real-time Events (Ably) ──
export type AblyEventType =
    | "task.created"
    | "task.updated"
    | "task.completed"
    | "task.failed"
    | "agent.status"
    | "channel.status"
    | "security.alert";

export interface AblyEvent<T = unknown> {
    event: AblyEventType;
    data: T;
}

// ── Orchestrator Internal Types ──
export interface ContainerCreateRequest {
    agentId: string;
    userId: string;
    openclawVersion: string;
    envVars: Record<string, string>;
    files: { path: string; content: string }[];
    channels: ChannelType[];
    enableWhatsappSidecar: boolean;
}

export interface TaskEventPayload {
    agentId: string;
    event: "task.started" | "task.step" | "task.completed" | "task.failed";
    data: {
        externalId: string;
        summary?: string;
        step?: TaskStep;
        error?: string;
        tokensUsed?: number;
        durationMs?: number;
    };
}
