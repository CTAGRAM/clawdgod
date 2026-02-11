// ──────────────────────────────────────────────────────────────
// ClawdGod — OpenClaw config.json Generator
// Transforms wizard answers + channel configs into OpenClaw format
// Reference: OpenClaw config.json schema
// ──────────────────────────────────────────────────────────────

import type { WizardAnswers, ChannelType } from "@clawdgod/shared";
import { CRON_SUGGESTIONS, CONTAINER_DEFAULTS, OPENCLAW_TOOLS } from "@clawdgod/shared";

interface ChannelConfigs {
    [key: string]: Record<string, string>;
}

/**
 * Generate a complete OpenClaw config.json from wizard answers.
 */
export function generateOpenClawConfig(
    agentId: string,
    answers: WizardAnswers,
    channelConfigs: ChannelConfigs,
    decryptedApiKey: string
): string {
    // Model string: provider/model for OpenClaw format
    const modelString = answers.aiProvider === "custom"
        ? answers.modelName
        : `${answers.aiProvider}/${answers.modelName}`;

    const config: Record<string, any> = {
        agents: {
            defaults: {
                model: { primary: modelString },
                workspace: "/home/clawdgod/.openclaw/workspace",
                skipBootstrap: true,
                maxConcurrent: 4,
                subagents: { maxConcurrent: 8 },
            },
            list: [
                {
                    id: "main",
                    default: true,
                    workspace: "/home/clawdgod/.openclaw/workspace",
                    model: modelString,
                    identity: {
                        name: answers.agentName,
                        theme: `personal AI assistant for ${answers.fullName || "the user"} — a ${answers.occupation}`,
                        emoji: "🤖",
                    },
                },
            ],
        },
        // Pass AI key as env var, model config uses it
        env: buildEnvBlock(answers, decryptedApiKey),
        tools: {
            alsoAllow: [
                "group:plugins",
                ...(answers.enabledTools || []).map((t) => `tool:${t}`),
            ],
        },
        commands: {
            native: "auto",
            nativeSkills: "auto",
        },
        channels: buildChannelsBlock(answers, channelConfigs),
        gateway: {
            mode: "local",
            bind: "lan",
            controlUi: { allowInsecureAuth: true, dangerouslyDisableDeviceAuth: true },
        },
        plugins: {
            entries: buildPluginEntries(answers),
        },
    };

    return JSON.stringify(config, null, 2);
}

function buildEnvBlock(
    answers: WizardAnswers,
    decryptedApiKey: string
): Record<string, string> {
    const env: Record<string, string> = {};

    // Set the provider-specific API key env var
    switch (answers.aiProvider) {
        case "anthropic":
            env.ANTHROPIC_API_KEY = decryptedApiKey;
            break;
        case "openai":
            env.OPENAI_API_KEY = decryptedApiKey;
            break;
        case "google":
            env.GOOGLE_API_KEY = decryptedApiKey;
            break;
        case "openrouter":
            env.OPENROUTER_API_KEY = decryptedApiKey;
            break;
        case "custom":
            env.OPENAI_API_KEY = decryptedApiKey; // custom uses OpenAI-compatible
            if (answers.baseUrl) env.OPENAI_BASE_URL = answers.baseUrl;
            break;
    }

    // Add tool API keys
    if (answers.enabledTools && answers.toolApiKeys) {
        for (const toolKey of answers.enabledTools) {
            const toolDef = OPENCLAW_TOOLS[toolKey as keyof typeof OPENCLAW_TOOLS];
            if (toolDef && 'envVar' in toolDef && toolDef.requiresApiKey) {
                const apiKeyValue = answers.toolApiKeys[toolKey];
                if (apiKeyValue) {
                    env[(toolDef as any).envVar] = apiKeyValue;
                }
            }
        }
    }

    return env;
}

function buildChannelsBlock(
    answers: WizardAnswers,
    channelConfigs: ChannelConfigs
): Record<string, any> {
    const channels: Record<string, any> = {};

    for (const ch of answers.channels) {
        const cfg = channelConfigs[ch] || {};

        switch (ch) {
            case "telegram": {
                // dmPolicy "open" requires "*" in allowFrom
                const allowFrom: string[] = ["*"];
                // Also include specific TG user ID if provided
                if (cfg.telegramUserId) {
                    allowFrom.push(cfg.telegramUserId);
                }

                channels.telegram = {
                    dmPolicy: "open",
                    botToken: cfg.botToken || "",
                    allowFrom,
                    groupPolicy: "allowlist",
                    streamMode: "partial",
                };
                break;
            }

            case "discord": {
                channels.discord = {
                    botToken: cfg.botToken || "",
                    applicationId: cfg.applicationId || "",
                    dmPolicy: "open",
                };
                break;
            }

            case "whatsapp": {
                // WhatsApp is handled by the OpenCLAW whatsapp plugin — no channel config needed
                channels.whatsapp = {};
                break;
            }
        }
    }

    return channels;
}

function buildPluginEntries(
    answers: WizardAnswers
): Record<string, any> {
    const entries: Record<string, any> = {};

    // Enable channel plugins
    for (const ch of answers.channels) {
        entries[ch] = { enabled: true };
    }

    // Enable tool plugins
    if (answers.enabledTools) {
        for (const tool of answers.enabledTools) {
            entries[tool] = { enabled: true };
        }
    }

    // Enable skill plugins
    if (answers.enabledSkills) {
        for (const skill of answers.enabledSkills) {
            entries[skill] = { enabled: true };
        }
    }

    return entries;
}

/**
 * Build the env vars map for docker container creation.
 * These are passed as -e flags to docker run.
 */
export function buildContainerEnvVars(
    answers: WizardAnswers,
    decryptedApiKey: string
): Record<string, string> {
    // Reuse buildEnvBlock which already handles both provider and tool API keys
    return buildEnvBlock(answers, decryptedApiKey);
}
