// ──────────────────────────────────────────────────────────────
// ClawdGod — Shared Constants
// ──────────────────────────────────────────────────────────────

// ── Plan Limits ──
export const PLAN_LIMITS = {
    starter: {
        maxAgents: 1,
        maxChannels: 1,
        maxTasksPerMonth: 500,
        maxCronJobs: 5,
        taskHistoryDays: 7,
        sharedNode: true,
        advancedSkills: false,
        apiAccess: false,
    },
    pro: {
        maxAgents: 3,
        maxChannels: 3,
        maxTasksPerMonth: Infinity,
        maxCronJobs: 20,
        taskHistoryDays: Infinity,
        sharedNode: false,
        advancedSkills: true,
        apiAccess: true,
    },
    builder: {
        maxAgents: 10,
        maxChannels: 3,
        maxTasksPerMonth: Infinity,
        maxCronJobs: 50,
        taskHistoryDays: Infinity,
        sharedNode: false,
        advancedSkills: true,
        apiAccess: true,
    },
} as const;

// ── Trial Limits ──
export const TRIAL_LIMITS = {
    maxAgents: 1,
    maxChannels: 1,
    trialDurationMs: 60 * 60 * 1000,            // 1 hour
    deletionGracePeriodMs: 24 * 60 * 60 * 1000,  // 24 hours after trial ends
} as const;

// ── Pricing ──
export const PLAN_PRICES = {
    starter: 2900, // cents
    pro: 5900,
    builder: 9900,
} as const;

// ── OpenClaw Container Paths ──
export const OPENCLAW_PATHS = {
    configDir: "/home/clawdgod/.openclaw",
    soulMd: "/home/clawdgod/.openclaw/SOUL.md",
    userMd: "/home/clawdgod/.openclaw/USER.md",
    toolsMd: "/home/clawdgod/.openclaw/TOOLS.md",
    configJson: "/home/clawdgod/.openclaw/config.json",
    memory: "/home/clawdgod/.openclaw/memory/",
    skills: "/home/clawdgod/.openclaw/skills/",
    tmpfsConfig: "/run/openclaw-config/config.json",
} as const;

// ── Container Settings ──
export const CONTAINER_DEFAULTS = {
    openclawVersion: "2026.2.9",
    openclawImage: "openclaw:latest",
    controlUiPort: 18789,
    bridgePort: 18790,
    healthCheckIntervalMs: 60_000,
    healthCheckMaxFails: 3,
    cpuLimit: "0.5",
    memoryLimit: "1g",
    cpuBurst: "1.0",
    memoryBurst: "1g",
    maxUsersPerSharedNode: 4,
} as const;

// ── JWT Settings ──
export const AUTH_SETTINGS = {
    accessTokenExpiresIn: "15m",
    refreshTokenExpiresIn: "7d",
    refreshTokenMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    authRateLimit: { max: 10, timeWindow: "15 minutes" },
    apiRateLimit: { max: 100, timeWindow: "1 minute" },
    expensiveRateLimit: { max: 10, timeWindow: "1 minute" },
} as const;

// ── Token Rotation ──
export const SECURITY_SETTINGS = {
    tokenRotationIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
    gracePeriodDays: 7,
    dataRetentionDays: 30,
} as const;

// ── Provider Display Names ──
export const PROVIDER_DISPLAY = {
    anthropic: { name: "Anthropic Claude", badge: "Best quality" },
    openai: { name: "OpenAI GPT", badge: "Most popular" },
    google: { name: "Google Gemini", badge: "Fast & multimodal" },
    openrouter: { name: "OpenRouter", badge: "100+ models" },
    custom: { name: "Custom / Other", badge: "Any OpenAI-compatible API" },
} as const;

// ── Default Models per Provider ──
export const DEFAULT_MODELS = {
    anthropic: ["claude-opus-4-5-20251101", "claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"],
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o3"],
    google: ["gemini-2.0-flash", "gemini-2.0-pro"],
    openrouter: [], // fetched dynamically
    custom: [],
} as const;

// ── Channel Display ──
export const CHANNEL_DISPLAY = {
    telegram: { name: "Telegram", icon: "telegram", description: "Most popular messaging platform" },
    whatsapp: { name: "WhatsApp", icon: "whatsapp", description: "Your personal number stays yours" },
    discord: { name: "Discord", icon: "discord", description: "For teams and communities" },
} as const;

// ── Cron Suggestions ──

// ── OpenCLAW Tools ──
export const OPENCLAW_TOOLS = {
    brave_search: {
        name: "Brave Search",
        description: "Web search powered by Brave API",
        requiresApiKey: true,
        envVar: "BRAVE_API_KEY",
        badge: "Search",
        icon: "search",
    },
    nanobanana: {
        name: "NanoBanana",
        description: "AI image generation tool",
        requiresApiKey: true,
        envVar: "NANOBANANA_API_KEY",
        badge: "Image Gen",
        icon: "image",
    },
    tavily: {
        name: "Tavily Search",
        description: "AI-optimized web search \u0026 research",
        requiresApiKey: true,
        envVar: "TAVILY_API_KEY",
        badge: "Search",
        icon: "search",
    },
    computer_use: {
        name: "Computer Use",
        description: "Browser and desktop automation",
        requiresApiKey: false,
        badge: "Automation",
        icon: "monitor",
    },
    web_browse: {
        name: "Web Browsing",
        description: "Fetch and read web pages",
        requiresApiKey: false,
        badge: "Web",
        icon: "globe",
    },
    file_ops: {
        name: "File Operations",
        description: "Read, write, and manage files",
        requiresApiKey: false,
        badge: "Files",
        icon: "file",
    },
    code_exec: {
        name: "Code Execution",
        description: "Run code snippets in sandbox",
        requiresApiKey: false,
        badge: "Code",
        icon: "code",
    },
} as const;

// ── OpenCLAW Skills ──
export const OPENCLAW_SKILLS = {
    email_management: { name: "Email Management", description: "Read, compose, and organize emails", category: "Productivity" },
    calendar_management: { name: "Calendar Management", description: "Schedule and manage calendar events", category: "Productivity" },
    task_management: { name: "Task Management", description: "Create and manage tasks across tools", category: "Productivity" },
    research: { name: "Deep Research", description: "Multi-step web research with synthesis", category: "Research" },
    code_review: { name: "Code Review", description: "Analyze and review code quality", category: "Development" },
    data_analysis: { name: "Data Analysis", description: "Analyze data and generate insights", category: "Analysis" },
    social_media: { name: "Social Media", description: "Draft and schedule social posts", category: "Marketing" },
    writing: { name: "Content Writing", description: "Write articles, blogs, and copy", category: "Content" },
} as const;
export const CRON_SUGGESTIONS: Record<string, { name: string; expression: string; description: string }> = {
    email_management: { name: "Daily Email Summary", expression: "0 8 * * *", description: "Summarize unread emails every morning at 8am" },
    calendar: { name: "Daily Meeting Brief", expression: "50 7 * * *", description: "Brief you on today's meetings at 7:50am" },
    task_management: { name: "Weekly Task Review", expression: "0 18 * * 0", description: "Weekly task review every Sunday at 6pm" },
    research: { name: "Daily News Digest", expression: "0 9 * * *", description: "Research digest every morning at 9am" },
    finance_tracking: { name: "Weekly Finance Summary", expression: "0 10 * * 1", description: "Weekly finance summary every Monday at 10am" },
};
