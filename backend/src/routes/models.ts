// ──────────────────────────────────────────────────────────────
// ClawdGod — Model Discovery Routes
// Fetches available models from AI provider APIs
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";

const fetchModelsSchema = z.object({
    provider: z.enum(["anthropic", "openai", "google", "openrouter", "custom"]),
    apiKey: z.string().min(1),
    baseUrl: z.string().url().optional(),
});

// Provider API base URLs
const PROVIDER_URLS: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    google: "https://generativelanguage.googleapis.com/v1beta",
    openrouter: "https://openrouter.ai/api/v1",
};

interface ModelInfo {
    id: string;
    name: string;
    owned_by?: string;
}

async function fetchOpenAICompatible(baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
    const url = `${baseUrl}/models`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "User-Agent": "ClawdGod/1.0",
            "HTTP-Referer": "https://clawdgod.com",
        },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`API returned ${res.status} from ${url}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const models = (data.data || []) as any[];
    return models
        .filter((m: any) => {
            const id = m.id?.toLowerCase() || "";
            // Filter to chat/completion models, skip embeddings/whisper/etc
            return !id.includes("embed") &&
                !id.includes("whisper") &&
                !id.includes("tts") &&
                !id.includes("dall-e") &&
                !id.includes("moderation") &&
                !id.includes("davinci") &&
                !id.includes("babbage");
        })
        .map((m: any) => ({
            id: m.id,
            name: m.id,
            owned_by: m.owned_by,
        }))
        .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    const models = (data.data || []) as any[];
    return models
        .map((m: any) => ({
            id: m.id,
            name: m.display_name || m.id,
            owned_by: "anthropic",
        }))
        .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
}

async function fetchGoogleModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    const models = (data.models || []) as any[];
    return models
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => ({
            id: m.name?.replace("models/", "") || m.name,
            name: m.displayName || m.name,
            owned_by: "google",
        }))
        .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id));
}

export async function modelRoutes(app: FastifyInstance) {
    app.addHook("preHandler", requireAuth);

    // ── Fetch Models ──
    app.post("/api/models", async (request, reply) => {
        const parsed = fetchModelsSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten().fieldErrors });
        }

        const { provider, apiKey, baseUrl } = parsed.data;

        try {
            let models: ModelInfo[];

            switch (provider) {
                case "anthropic":
                    models = await fetchAnthropicModels(apiKey);
                    break;
                case "google":
                    models = await fetchGoogleModels(apiKey);
                    break;
                case "openai":
                    models = await fetchOpenAICompatible(
                        baseUrl || PROVIDER_URLS.openai,
                        apiKey
                    );
                    break;
                case "openrouter":
                    models = await fetchOpenAICompatible(
                        baseUrl || PROVIDER_URLS.openrouter,
                        apiKey
                    );
                    break;
                case "custom":
                    if (!baseUrl) {
                        return reply.status(400).send({ error: "Base URL required for custom provider" });
                    }
                    models = await fetchOpenAICompatible(baseUrl, apiKey);
                    break;
                default:
                    models = [];
            }

            return reply.send({ models });
        } catch (err: any) {
            app.log.warn(`Model fetch failed for ${provider}: ${err.message}`);
            return reply.status(502).send({
                error: "Could not fetch models from provider",
                detail: err.message,
            });
        }
    });
}
