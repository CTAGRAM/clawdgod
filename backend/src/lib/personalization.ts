// ──────────────────────────────────────────────────────────────
// ClawdGod — Personalization Engine
// Generates SOUL.md, USER.md, TOOLS.md using the USER's own AI key
// No platform API key required — each user provides their own
// Prompts match PRD §5.4 exactly
// ──────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import type { WizardAnswers, AIProvider } from "@clawdgod/shared";

/**
 * Create an AI completion using the user's own API key.
 * Supports Anthropic and OpenAI-compatible providers.
 */
async function generateWithUserKey(
    provider: AIProvider,
    apiKey: string,
    modelName: string,
    prompt: string
): Promise<string> {
    if (provider === "anthropic") {
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
            model: modelName || "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
        });
        const textBlock = response.content.find((b) => b.type === "text");
        return textBlock?.text ?? "";
    }

    // OpenAI, Groq, OpenRouter — all use OpenAI-compatible endpoint
    const baseUrls: Record<string, string> = {
        openai: "https://api.openai.com/v1",
        groq: "https://api.groq.com/openai/v1",
        openrouter: "https://openrouter.ai/api/v1",
    };

    const baseUrl = baseUrls[provider] || baseUrls.openai;
    const model = modelName || "gpt-4o";

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            // Newer OpenAI models (o1, o3, gpt-4.1+) require max_completion_tokens
            ...(provider === "openai"
                ? { max_completion_tokens: 1024 }
                : { max_tokens: 1024 }),
            messages: [{ role: "user", content: prompt }],
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`AI API error (${provider}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
}

interface GenerateOptions {
    provider: AIProvider;
    apiKey: string;
    modelName: string;
}

// ── SOUL.md ──
export async function generateSoulMd(answers: WizardAnswers, opts: GenerateOptions): Promise<string> {
    const prompt = `You are writing a SOUL.md file for an OpenClaw AI agent. SOUL.md defines the agent's personality, values, communication style, and operational philosophy.

User profile:
- Name: ${answers.fullName || "the user"}
- Occupation: ${answers.occupation}
- Communication preference: ${answers.communicationStyle}
- Biggest frustration: ${answers.biggestFrustration}
- Main goal for agent: ${answers.mainGoal}
- Active hours: ${answers.timezone} ${answers.activePeriod}

Write a SOUL.md that:
1. Defines a warm, capable assistant personality that matches their communication preference
2. Sets priorities that address their biggest frustration
3. Establishes values that align with their goal
4. Specifies proactive behaviors (when to check in, when to act vs ask)
5. Is 200-350 words
6. Uses first-person from the agent's perspective
7. Does NOT start with "I am" — be creative
8. Include a section "## My Operating Principles" with 4–6 bullet points

Output only the Markdown content for SOUL.md, nothing else.`;

    return generateWithUserKey(opts.provider, opts.apiKey, opts.modelName, prompt);
}

// ── USER.md ──
export async function generateUserMd(answers: WizardAnswers, opts: GenerateOptions): Promise<string> {
    const prompt = `Write a USER.md file for an OpenClaw AI agent. USER.md tells the agent everything relevant about the person they serve so they can be maximally useful from day 1.

User data:
- Full name: ${answers.fullName || "Not provided"}
- Company/project: ${answers.company || "Not provided"}
- Occupation: ${answers.occupation}
- Key tools: ${answers.topTools.join(", ")}
- Key people to know: ${answers.keyPeople || "Not provided"}
- Recurring tasks they mentioned: ${answers.recurringTasks || "Not provided"}
- Active hours: ${answers.timezone} ${answers.activePeriod}

Write USER.md that:
1. Is structured with headers: ## Identity, ## Work Context, ## Key People, ## Preferences, ## Regular Patterns
2. Under each header, write factual, useful bullet points
3. Is 150–250 words
4. Includes ONLY information provided — do not invent or assume
5. Ends with ## Communication Notes with 2–3 specific notes about how to communicate with this person

Output only the Markdown content for USER.md, nothing else.`;

    return generateWithUserKey(opts.provider, opts.apiKey, opts.modelName, prompt);
}

// ── TOOLS.md ──
export async function generateToolsMd(answers: WizardAnswers, opts: GenerateOptions): Promise<string> {
    const cronDescriptions = answers.enabledCrons.length > 0
        ? answers.enabledCrons.join(", ")
        : "None configured";

    const prompt = `Write a TOOLS.md file for an OpenClaw AI agent. TOOLS.md lists available integrations and how to use them.

Available in this deployment:
- Messaging channels: ${answers.channels.join(", ")}
- User's regular tools: ${answers.topTools.join(", ")}
- Cron jobs configured: ${cronDescriptions}

Write TOOLS.md that:
1. Has a ## Available Channels section listing each connected channel and its capabilities
2. Has a ## External Integrations section for each of the user's tools with notes on how to help with them
3. Has a ## Scheduled Tasks section listing each cron job, its schedule, and expected output
4. Is 200–350 words
5. Is practical and specific, not generic

Output only the Markdown content for TOOLS.md, nothing else.`;

    return generateWithUserKey(opts.provider, opts.apiKey, opts.modelName, prompt);
}

/**
 * Generate all three personalization files using the user's own AI key.
 */
export async function generateAllPersonalizationFiles(
    answers: WizardAnswers,
    opts?: GenerateOptions
) {
    // If no opts provided (e.g., regeneration), use a fallback
    // that creates templates without AI
    if (!opts) {
        return {
            soulMd: generateTemplateSoulMd(answers),
            userMd: generateTemplateUserMd(answers),
            toolsMd: generateTemplateToolsMd(answers),
        };
    }

    const [soulMd, userMd, toolsMd] = await Promise.all([
        generateSoulMd(answers, opts),
        generateUserMd(answers, opts),
        generateToolsMd(answers, opts),
    ]);

    return { soulMd, userMd, toolsMd };
}

// ── Template fallbacks (when no AI key is available for regeneration) ──

function generateTemplateSoulMd(a: WizardAnswers): string {
    return `# SOUL.md

## Who I Am
A capable, ${a.communicationStyle} assistant built to serve ${a.fullName || "you"} — a ${a.occupation} focused on ${a.mainGoal}.

## My Operating Principles
- Address ${a.biggestFrustration} proactively
- Communicate in a ${a.communicationStyle} style
- Be available during ${a.activePeriod} (${a.timezone})
- Act first on routine tasks, ask before anything irreversible
- Keep you informed without overwhelming you
`;
}

function generateTemplateUserMd(a: WizardAnswers): string {
    return `# USER.md

## Identity
- Name: ${a.fullName || "Not set"}
- Role: ${a.occupation}
${a.company ? `- Company: ${a.company}` : ""}

## Work Context
- Tools: ${a.topTools.join(", ")}
${a.keyPeople ? `- Key People: ${a.keyPeople}` : ""}
${a.recurringTasks ? `- Recurring: ${a.recurringTasks}` : ""}

## Preferences
- Style: ${a.communicationStyle}
- Active: ${a.activePeriod} (${a.timezone})
`;
}

function generateTemplateToolsMd(a: WizardAnswers): string {
    const channels = a.channels.map((c: string) => `- **${c}**: Connected and active`).join("\n");
    return `# TOOLS.md

## Available Channels
${channels}

## External Integrations
${a.topTools.map((t: string) => `- **${t}**: Available for assistance`).join("\n")}

## Scheduled Tasks
${a.enabledCrons.length > 0 ? a.enabledCrons.map((c: string) => `- ${c}`).join("\n") : "- None configured"}
`;
}
