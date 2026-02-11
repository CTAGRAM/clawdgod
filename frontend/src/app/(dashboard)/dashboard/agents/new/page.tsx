"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
    Bot,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Check,
    Zap,
    MessageSquare,
    Send,
    Phone,
    Gamepad2,
    Key,
    Brain,
    User,
    Briefcase,
    Clock,
    Target,
    Calendar,
    Rocket,
    Search,
    AlertCircle,
    Keyboard,
    Wrench,
    Sparkles,
    Globe,
    Monitor,
    FileText,
    Code,
    Image,
    Settings2,
} from "lucide-react";
import {
    PROVIDER_DISPLAY,
    CHANNEL_DISPLAY,
    DEFAULT_MODELS,
    CRON_SUGGESTIONS,
    OPENCLAW_TOOLS,
    OPENCLAW_SKILLS,
} from "@clawdgod/shared";
import type { WizardAnswers, ChannelType, AIProvider } from "@clawdgod/shared";

const STEPS = [
    { title: "Setup Mode", icon: Settings2 },
    { title: "Name Your Agent", icon: Bot },
    { title: "Choose Channels", icon: MessageSquare },
    { title: "AI Provider", icon: Brain },
    { title: "API Key & Model", icon: Key },
    { title: "Telegram Setup", icon: Send },
    { title: "WhatsApp Setup", icon: Phone },
    { title: "Discord Setup", icon: Gamepad2 },
    { title: "Tools", icon: Wrench },
    { title: "Skills", icon: Sparkles },
    { title: "About You", icon: User },
    { title: "Your Work", icon: Briefcase },
    { title: "Preferences", icon: Target },
    { title: "Scheduled Tasks", icon: Calendar },
    { title: "Review & Deploy", icon: Rocket },
];

type ChannelConfigs = Record<string, Record<string, string>>;

interface ModelInfo {
    id: string;
    name: string;
    owned_by?: string;
}

const toolIcons: Record<string, typeof Search> = {
    search: Search,
    image: Image,
    monitor: Monitor,
    globe: Globe,
    file: FileText,
    code: Code,
};

export default function NewAgentWizard() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [deploying, setDeploying] = useState(false);
    const [error, setError] = useState("");

    const [answers, setAnswers] = useState<Partial<WizardAnswers>>({
        agentName: "",
        setupMode: "basic",
        channels: [],
        aiProvider: "anthropic",
        modelName: "",
        enabledTools: [],
        toolApiKeys: {},
        enabledSkills: [],
        occupation: "",
        topTools: [],
        helpWith: [],
        communicationStyle: "balanced",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        activePeriod: "9am-6pm",
        biggestFrustration: "",
        mainGoal: "",
        enabledCrons: [],
    });

    const [apiKey, setApiKey] = useState("");
    const [channelConfigs, setChannelConfigs] = useState<ChannelConfigs>({
        telegram: { botToken: "", telegramUserId: "" },
        whatsapp: {},
        discord: { botToken: "", applicationId: "" },
    });
    const [toolInput, setToolInput] = useState("");

    // Dynamic model loading state
    const [fetchedModels, setFetchedModels] = useState<ModelInfo[]>([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsError, setModelsError] = useState("");
    const [useManualModel, setUseManualModel] = useState(false);
    const [modelSearch, setModelSearch] = useState("");

    const update = (partial: Partial<WizardAnswers>) =>
        setAnswers((prev) => ({ ...prev, ...partial }));

    const isBasicMode = answers.setupMode === "basic";

    // Skip channel-specific steps or full-only steps
    const isStepRelevant = (idx: number): boolean => {
        // Step 0 (Setup Mode) is always shown
        if (idx === 5) return answers.channels?.includes("telegram") ?? false;
        if (idx === 6) return false; // WhatsApp — coming soon
        if (idx === 7) return false; // Discord — coming soon
        // Steps 8 (Tools) and 9 (Skills) only in full mode
        if (idx === 8) return !isBasicMode;
        if (idx === 9) return !isBasicMode;
        // Steps 11 (Your Work), 13 (Cron Jobs) only in full mode
        if (idx === 11) return !isBasicMode;
        if (idx === 13) return !isBasicMode;
        return true;
    };

    const goNext = () => {
        let nextStep = step + 1;
        while (nextStep < STEPS.length && !isStepRelevant(nextStep)) nextStep++;
        setStep(nextStep);
    };
    const goPrev = () => {
        let prevStep = step - 1;
        while (prevStep >= 0 && !isStepRelevant(prevStep)) prevStep--;
        setStep(Math.max(0, prevStep));
    };

    // Fetch models when API key is entered on step 4
    const fetchModels = useCallback(async () => {
        if (!apiKey || apiKey.length < 10 || !answers.aiProvider) return;

        setModelsLoading(true);
        setModelsError("");
        setFetchedModels([]);

        try {
            const data = await api("/api/models", {
                method: "POST",
                body: JSON.stringify({
                    provider: answers.aiProvider,
                    apiKey,
                    baseUrl: answers.baseUrl,
                }),
            });
            setFetchedModels(data.models || []);
            if (data.models?.length > 0 && !answers.modelName) {
                update({ modelName: data.models[0].id });
            }
        } catch (err: any) {
            setModelsError(err.message || "Could not fetch models");
            const defaults = DEFAULT_MODELS[answers.aiProvider as keyof typeof DEFAULT_MODELS] || [];
            if (defaults.length > 0) {
                setFetchedModels(defaults.map((id: string) => ({ id, name: id })));
                if (!answers.modelName) update({ modelName: defaults[0] });
            }
        } finally {
            setModelsLoading(false);
        }
    }, [apiKey, answers.aiProvider, answers.baseUrl]);

    // Auto-fetch models when API key changes (debounced)
    useEffect(() => {
        if (step !== 4 || !apiKey || apiKey.length < 10) return;
        const timer = setTimeout(fetchModels, 800);
        return () => clearTimeout(timer);
    }, [apiKey, step, fetchModels]);

    const filteredModels = fetchedModels.filter((m) =>
        m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.name.toLowerCase().includes(modelSearch.toLowerCase())
    );

    const deploy = async () => {
        setDeploying(true);
        setError("");
        try {
            await api("/api/agents", {
                method: "POST",
                body: JSON.stringify({
                    wizardAnswers: answers,
                    channelConfigs,
                    apiKey,
                }),
            });
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Deployment failed");
        } finally {
            setDeploying(false);
        }
    };

    // Count relevant steps for progress
    const relevantSteps = STEPS.filter((_, i) => isStepRelevant(i));
    const currentRelevantIdx = relevantSteps.findIndex(
        (_, i) => {
            let count = 0;
            for (let j = 0; j < STEPS.length; j++) {
                if (isStepRelevant(j)) {
                    if (count === i) return j === step;
                    count++;
                }
            }
            return false;
        }
    );
    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            {/* Progress */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-xl font-bold">
                        {isBasicMode && step > 0 ? "Quick Setup" : step === 0 ? "Setup Wizard" : "Full Setup"}
                    </h1>
                    <span className="text-text-muted text-sm">
                        Step {step + 1} of {STEPS.length}
                    </span>
                </div>
                <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-accent-purple rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Step Content */}
            <div className="glass-card p-8 animate-slide-up" key={step}>
                <div className="flex items-center gap-3 mb-6">
                    {(() => {
                        const Icon = STEPS[step].icon;
                        return <Icon className="w-6 h-6 text-primary" />;
                    })()}
                    <h2 className="text-lg font-semibold">{STEPS[step].title}</h2>
                </div>

                {/* Step 0: Setup Mode */}
                {step === 0 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">How would you like to set up your agent?</p>
                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={() => update({ setupMode: "basic" })}
                                className={`flex items-center gap-4 p-5 rounded-xl border transition-all duration-200 text-left
                                    ${answers.setupMode === "basic"
                                        ? "border-primary bg-primary/5 shadow-glow"
                                        : "border-border hover:border-primary/30"}`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${answers.setupMode === "basic" ? "bg-primary/20 text-primary" : "bg-surface text-text-muted"}`}>
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold">Basic &amp; Quick</p>
                                    <p className="text-sm text-text-muted">Name, channel, provider, and deploy. Takes under 2 minutes.</p>
                                </div>
                                {answers.setupMode === "basic" && <Check className="w-5 h-5 text-primary" />}
                            </button>
                            <button
                                onClick={() => update({ setupMode: "full" })}
                                className={`flex items-center gap-4 p-5 rounded-xl border transition-all duration-200 text-left
                                    ${answers.setupMode === "full"
                                        ? "border-primary bg-primary/5 shadow-glow"
                                        : "border-border hover:border-primary/30"}`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${answers.setupMode === "full" ? "bg-primary/20 text-primary" : "bg-surface text-text-muted"}`}>
                                    <Settings2 className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold">Full Setup</p>
                                    <p className="text-sm text-text-muted">Configure tools (Brave Search, NanoBanana…), skills, cron jobs, and detailed preferences.</p>
                                </div>
                                {answers.setupMode === "full" && <Check className="w-5 h-5 text-primary" />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 1: Agent Name */}
                {step === 1 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">Give your AI agent a name. This is how you&apos;ll identify it.</p>
                        <input
                            type="text"
                            placeholder="e.g., Jarvis, Friday, Atlas"
                            value={answers.agentName}
                            onChange={(e) => update({ agentName: e.target.value })}
                            className="input-field text-lg"
                            maxLength={30}
                            autoFocus
                        />
                    </div>
                )}

                {/* Step 2: Channels */}
                {step === 2 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">Where should your agent live? Select at least one.</p>
                        <div className="grid grid-cols-1 gap-3">
                            {(Object.entries(CHANNEL_DISPLAY) as [ChannelType, (typeof CHANNEL_DISPLAY)[ChannelType]][]).map(
                                ([key, info]) => {
                                    const selected = answers.channels?.includes(key);
                                    const comingSoon = key === "whatsapp" || key === "discord";
                                    return (
                                        <button
                                            key={key}
                                            disabled={comingSoon}
                                            onClick={() => {
                                                if (comingSoon) return;
                                                const channels = selected
                                                    ? answers.channels!.filter((c) => c !== key)
                                                    : [...(answers.channels || []), key];
                                                update({ channels });
                                            }}
                                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left
                                                ${comingSoon
                                                    ? "border-border/50 opacity-60 cursor-not-allowed"
                                                    : selected
                                                        ? "border-primary bg-primary/5 shadow-glow"
                                                        : "border-border hover:border-primary/30"}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected && !comingSoon ? "bg-primary/20 text-primary" : "bg-surface text-text-muted"}`}>
                                                {key === "telegram" && <Send className="w-5 h-5" />}
                                                {key === "whatsapp" && <Phone className="w-5 h-5" />}
                                                {key === "discord" && <Gamepad2 className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{info.name}</p>
                                                    {comingSoon && (
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-yellow/10 text-accent-yellow">
                                                            Coming Soon
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-text-muted">{info.description}</p>
                                            </div>
                                            {selected && !comingSoon && <Check className="w-5 h-5 text-primary" />}
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: AI Provider */}
                {step === 3 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">Which AI provider should power your agent?</p>
                        <div className="grid grid-cols-1 gap-3">
                            {(Object.entries(PROVIDER_DISPLAY) as [AIProvider, (typeof PROVIDER_DISPLAY)[AIProvider]][]).map(
                                ([key, info]) => {
                                    const selected = answers.aiProvider === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                update({
                                                    aiProvider: key,
                                                    modelName: "",
                                                });
                                                setFetchedModels([]);
                                                setModelsError("");
                                                setUseManualModel(false);
                                            }}
                                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left
                                                ${selected
                                                    ? "border-primary bg-primary/5 shadow-glow"
                                                    : "border-border hover:border-primary/30"}`}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{info.name}</p>
                                                    <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                        {info.badge}
                                                    </span>
                                                </div>
                                            </div>
                                            {selected && <Check className="w-5 h-5 text-primary" />}
                                        </button>
                                    );
                                }
                            )}
                        </div>

                        {/* Custom base URL */}
                        {answers.aiProvider === "custom" && (
                            <div>
                                <label className="text-sm text-text-secondary mb-2 block">Base URL (OpenAI-compatible)</label>
                                <input
                                    type="url"
                                    placeholder="https://api.your-provider.com/v1"
                                    value={answers.baseUrl || ""}
                                    onChange={(e) => update({ baseUrl: e.target.value })}
                                    className="input-field font-mono text-sm"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: API Key + Dynamic Model Selection */}
                {step === 4 && (
                    <div className="space-y-5">
                        <p className="text-text-secondary">
                            Enter your {PROVIDER_DISPLAY[answers.aiProvider as AIProvider]?.name || "AI"} API key.
                            Models will be loaded automatically.
                        </p>

                        {/* API Key Input */}
                        <div>
                            <label className="text-sm text-text-secondary mb-2 block">API Key</label>
                            <input
                                type="password"
                                placeholder="sk-..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="input-field font-mono"
                                autoFocus
                            />
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-green/5 border border-accent-green/10 mt-2">
                                <Check className="w-4 h-4 text-accent-green mt-0.5" />
                                <p className="text-sm text-text-secondary">
                                    Encrypted with AES-256-GCM. Only decrypted inside your isolated container.
                                </p>
                            </div>
                        </div>

                        {/* Model Selection */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-text-secondary">Model</label>
                                <button
                                    onClick={() => setUseManualModel(!useManualModel)}
                                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                                >
                                    <Keyboard className="w-3 h-3" />
                                    {useManualModel ? "Select from list" : "Enter manually"}
                                </button>
                            </div>

                            {useManualModel ? (
                                <input
                                    type="text"
                                    placeholder="e.g., gpt-4o, claude-sonnet-4-5-20250929, gemini-2.0-flash"
                                    value={answers.modelName}
                                    onChange={(e) => update({ modelName: e.target.value })}
                                    className="input-field font-mono text-sm"
                                />
                            ) : (
                                <div className="space-y-2">
                                    {modelsLoading && (
                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface text-text-muted text-sm">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Fetching models from {PROVIDER_DISPLAY[answers.aiProvider as AIProvider]?.name}...
                                        </div>
                                    )}

                                    {modelsError && !modelsLoading && (
                                        <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-yellow/5 border border-accent-yellow/20 text-sm">
                                            <AlertCircle className="w-4 h-4 text-accent-yellow mt-0.5" />
                                            <div>
                                                <p className="text-text-secondary">{modelsError}</p>
                                                <p className="text-text-muted text-xs mt-1">Using default models. You can also enter a model name manually.</p>
                                            </div>
                                        </div>
                                    )}

                                    {!apiKey && !modelsLoading && fetchedModels.length === 0 && (
                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface text-text-muted text-sm">
                                            <Key className="w-4 h-4" />
                                            Enter your API key above to load available models
                                        </div>
                                    )}

                                    {fetchedModels.length > 0 && !modelsLoading && (
                                        <>
                                            {fetchedModels.length > 6 && (
                                                <div className="relative">
                                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search models..."
                                                        value={modelSearch}
                                                        onChange={(e) => setModelSearch(e.target.value)}
                                                        className="input-field pl-9 text-sm"
                                                    />
                                                </div>
                                            )}

                                            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                                {filteredModels.map((model) => {
                                                    const selected = answers.modelName === model.id;
                                                    return (
                                                        <button
                                                            key={model.id}
                                                            onClick={() => update({ modelName: model.id })}
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-all
                                                                ${selected
                                                                    ? "border-primary bg-primary/5"
                                                                    : "border-border/50 hover:border-primary/30"}`}
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`font-mono text-sm truncate ${selected ? "text-primary" : ""}`}>
                                                                    {model.id}
                                                                </p>
                                                                {model.owned_by && (
                                                                    <p className="text-text-muted text-xs">{model.owned_by}</p>
                                                                )}
                                                            </div>
                                                            {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                                                        </button>
                                                    );
                                                })}
                                                {filteredModels.length === 0 && (
                                                    <p className="text-text-muted text-sm p-3 text-center">No models match your search</p>
                                                )}
                                            </div>
                                            <p className="text-text-muted text-xs">{fetchedModels.length} models available</p>
                                        </>
                                    )}

                                    {apiKey && apiKey.length >= 10 && !modelsLoading && (
                                        <button
                                            onClick={fetchModels}
                                            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                                        >
                                            <Search className="w-3 h-3" /> Refresh models
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 5: Telegram Setup */}
                {step === 5 && (
                    <div className="space-y-5">
                        <p className="text-text-secondary">
                            Set up your Telegram bot and link your account.
                        </p>
                        <div>
                            <label className="text-sm text-text-secondary mb-2 block">Bot Token</label>
                            <p className="text-xs text-text-muted mb-2">
                                Create a bot via <strong>@BotFather</strong> on Telegram → <code>/newbot</code> → copy the token.
                            </p>
                            <input
                                type="text"
                                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                                value={channelConfigs.telegram?.botToken || ""}
                                onChange={(e) =>
                                    setChannelConfigs((c) => ({
                                        ...c,
                                        telegram: { ...c.telegram, botToken: e.target.value },
                                    }))
                                }
                                className="input-field font-mono text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-text-secondary mb-2 block">Your Telegram User ID</label>
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10 mb-3">
                                <Send className="w-4 h-4 text-accent-blue mt-0.5 shrink-0" />
                                <div className="text-sm text-text-secondary">
                                    <p>
                                        Open Telegram → message <strong className="text-primary">@userinfobot</strong> → it
                                        will reply with your User ID. Paste it below.
                                    </p>
                                    <p className="text-xs text-text-muted mt-1">
                                        This ensures your bot only responds to you, not random strangers.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="e.g., 123456789"
                                value={channelConfigs.telegram?.telegramUserId || ""}
                                onChange={(e) =>
                                    setChannelConfigs((c) => ({
                                        ...c,
                                        telegram: { ...c.telegram, telegramUserId: e.target.value },
                                    }))
                                }
                                className="input-field font-mono text-sm"
                            />
                        </div>
                    </div>
                )}

                {/* Step 6: WhatsApp */}
                {step === 6 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">
                            WhatsApp will be configured after deployment. You&apos;ll scan a QR code from your dashboard.
                        </p>
                        <div className="p-4 rounded-xl bg-accent-blue/5 border border-accent-blue/10 text-sm text-text-secondary">
                            <p>📱 <strong>How it works:</strong> We run a Waha WhatsApp bridge alongside your agent. After deploy, scan the QR once to link your WhatsApp number. The session persists automatically.</p>
                        </div>
                    </div>
                )}

                {/* Step 7: Discord */}
                {step === 7 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">
                            Create a Discord application at{" "}
                            <a href="https://discord.com/developers/applications" target="_blank" className="text-primary hover:underline">
                                discord.com/developers
                            </a>{" "}
                            and paste your bot token.
                        </p>
                        <input
                            type="text"
                            placeholder="Bot token"
                            value={channelConfigs.discord?.botToken || ""}
                            onChange={(e) =>
                                setChannelConfigs((c) => ({
                                    ...c,
                                    discord: { ...c.discord, botToken: e.target.value },
                                }))
                            }
                            className="input-field font-mono text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Application ID"
                            value={channelConfigs.discord?.applicationId || ""}
                            onChange={(e) =>
                                setChannelConfigs((c) => ({
                                    ...c,
                                    discord: { ...c.discord, applicationId: e.target.value },
                                }))
                            }
                            className="input-field font-mono text-sm"
                        />
                    </div>
                )}

                {/* Step 8: Tools (Full Setup Only) */}
                {step === 8 && (
                    <div className="space-y-5">
                        <p className="text-text-secondary">
                            Select the tools your agent can use. Some require an API key.
                        </p>
                        <div className="space-y-3">
                            {(Object.entries(OPENCLAW_TOOLS) as [string, (typeof OPENCLAW_TOOLS)[keyof typeof OPENCLAW_TOOLS]][]).map(
                                ([key, tool]) => {
                                    const selected = answers.enabledTools?.includes(key);
                                    const ToolIcon = toolIcons[tool.icon] || Wrench;
                                    return (
                                        <div key={key} className="space-y-2">
                                            <button
                                                onClick={() => {
                                                    const tools = selected
                                                        ? answers.enabledTools!.filter((t) => t !== key)
                                                        : [...(answers.enabledTools || []), key];
                                                    update({ enabledTools: tools });
                                                }}
                                                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left
                                                    ${selected
                                                        ? "border-primary bg-primary/5 shadow-glow"
                                                        : "border-border hover:border-primary/30"}`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? "bg-primary/20 text-primary" : "bg-surface text-text-muted"}`}>
                                                    <ToolIcon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium">{tool.name}</p>
                                                        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                                            {tool.badge}
                                                        </span>
                                                        {tool.requiresApiKey && (
                                                            <span className="text-xs text-accent-yellow bg-accent-yellow/10 px-2 py-0.5 rounded-full">
                                                                API Key
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-text-muted">{tool.description}</p>
                                                </div>
                                                {selected && <Check className="w-5 h-5 text-primary shrink-0" />}
                                            </button>

                                            {/* API Key input for selected tools that require it */}
                                            {selected && tool.requiresApiKey && (
                                                <div className="ml-14 pr-4">
                                                    <input
                                                        type="password"
                                                        placeholder={`Enter ${tool.name} API key`}
                                                        value={answers.toolApiKeys?.[key] || ""}
                                                        onChange={(e) =>
                                                            update({
                                                                toolApiKeys: {
                                                                    ...answers.toolApiKeys,
                                                                    [key]: e.target.value,
                                                                },
                                                            })
                                                        }
                                                        className="input-field font-mono text-sm"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    </div>
                )}

                {/* Step 9: Skills (Full Setup Only) */}
                {step === 9 && (
                    <div className="space-y-5">
                        <p className="text-text-secondary">
                            Enable skills to give your agent specialized abilities.
                        </p>

                        {/* Group by category */}
                        {(() => {
                            const categories = new Map<string, [string, (typeof OPENCLAW_SKILLS)[keyof typeof OPENCLAW_SKILLS]][]>();
                            for (const [key, skill] of Object.entries(OPENCLAW_SKILLS)) {
                                const cat = skill.category;
                                if (!categories.has(cat)) categories.set(cat, []);
                                categories.get(cat)!.push([key, skill]);
                            }

                            return Array.from(categories.entries()).map(([category, skills]) => (
                                <div key={category}>
                                    <h3 className="text-sm font-medium text-text-muted mb-2">{category}</h3>
                                    <div className="space-y-2">
                                        {skills.map(([key, skill]) => {
                                            const selected = answers.enabledSkills?.includes(key);
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => {
                                                        const s = selected
                                                            ? answers.enabledSkills!.filter((sk) => sk !== key)
                                                            : [...(answers.enabledSkills || []), key];
                                                        update({ enabledSkills: s });
                                                    }}
                                                    className={`w-full flex items-center gap-4 p-3 rounded-xl border text-left transition-all
                                                        ${selected
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border/50 hover:border-primary/30"}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selected ? "bg-primary/20 text-primary" : "bg-surface text-text-muted"}`}>
                                                        <Sparkles className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{skill.name}</p>
                                                        <p className="text-xs text-text-muted">{skill.description}</p>
                                                    </div>
                                                    {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Step 10: About You */}
                {step === 10 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">Tell your agent about yourself so it can help you better.</p>
                        <input
                            type="text"
                            placeholder="Full name (optional)"
                            value={answers.fullName || ""}
                            onChange={(e) => update({ fullName: e.target.value })}
                            className="input-field"
                        />
                        <input
                            type="text"
                            placeholder="Your occupation (e.g., Product Manager, Developer)"
                            value={answers.occupation}
                            onChange={(e) => update({ occupation: e.target.value })}
                            className="input-field"
                        />
                        <input
                            type="text"
                            placeholder="Company or project (optional)"
                            value={answers.company || ""}
                            onChange={(e) => update({ company: e.target.value })}
                            className="input-field"
                        />
                    </div>
                )}

                {/* Step 11: Your Work (Full Only) */}
                {step === 11 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">What tools and tasks take up your day?</p>
                        <div>
                            <label className="text-sm text-text-secondary mb-2 block">Tools you use daily</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Add a tool (e.g., Slack, Notion, GitHub)"
                                    value={toolInput}
                                    onChange={(e) => setToolInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && toolInput.trim()) {
                                            update({ topTools: [...(answers.topTools || []), toolInput.trim()] });
                                            setToolInput("");
                                        }
                                    }}
                                    className="input-field flex-1"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {answers.topTools?.map((tool, i) => (
                                    <span
                                        key={i}
                                        className="badge-purple cursor-pointer"
                                        onClick={() => update({ topTools: answers.topTools!.filter((_, j) => j !== i) })}
                                    >
                                        {tool} ×
                                    </span>
                                ))}
                            </div>
                        </div>
                        <input
                            type="text"
                            placeholder="Key people your agent should know about"
                            value={answers.keyPeople || ""}
                            onChange={(e) => update({ keyPeople: e.target.value })}
                            className="input-field"
                        />
                        <input
                            type="text"
                            placeholder="Recurring tasks (comma-separated)"
                            value={answers.recurringTasks || ""}
                            onChange={(e) => update({ recurringTasks: e.target.value })}
                            className="input-field"
                        />
                    </div>
                )}

                {/* Step 12: Preferences */}
                {step === 12 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">How should your agent communicate?</p>
                        <div>
                            <label className="text-sm text-text-secondary mb-2 block">Communication Style</label>
                            <div className="grid grid-cols-3 gap-2">
                                {["concise", "balanced", "detailed"].map((style) => (
                                    <button
                                        key={style}
                                        onClick={() => update({ communicationStyle: style })}
                                        className={`p-3 rounded-xl border text-sm capitalize transition-all
                                            ${answers.communicationStyle === style
                                                ? "border-primary bg-primary/5 text-primary"
                                                : "border-border hover:border-primary/30"}`}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="text"
                            placeholder="Your biggest frustration at work"
                            value={answers.biggestFrustration}
                            onChange={(e) => update({ biggestFrustration: e.target.value })}
                            className="input-field"
                        />
                        <input
                            type="text"
                            placeholder="Main goal for your agent"
                            value={answers.mainGoal}
                            onChange={(e) => update({ mainGoal: e.target.value })}
                            className="input-field"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Active hours (e.g., 9am-6pm)"
                                value={answers.activePeriod}
                                onChange={(e) => update({ activePeriod: e.target.value })}
                                className="input-field"
                            />
                            <input
                                type="text"
                                value={answers.timezone}
                                onChange={(e) => update({ timezone: e.target.value })}
                                className="input-field"
                            />
                        </div>
                    </div>
                )}

                {/* Step 13: Cron Jobs (Full Only) */}
                {step === 13 && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">Want your agent to run tasks on a schedule?</p>
                        <div className="space-y-2">
                            {Object.entries(CRON_SUGGESTIONS).map(([key, cron]) => {
                                const selected = answers.enabledCrons?.includes(key);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            const crons = selected
                                                ? answers.enabledCrons!.filter((c) => c !== key)
                                                : [...(answers.enabledCrons || []), key];
                                            update({ enabledCrons: crons });
                                        }}
                                        className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all
                                            ${selected
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/30"}`}
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{cron.name}</p>
                                            <p className="text-xs text-text-muted">{cron.description}</p>
                                        </div>
                                        <span className="text-xs font-mono text-text-muted">{cron.expression}</span>
                                        {selected && <Check className="w-4 h-4 text-primary" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 14: Review & Deploy */}
                {step === 14 && (
                    <div className="space-y-6">
                        <p className="text-text-secondary">Review your configuration and deploy.</p>

                        <div className="space-y-3">
                            <ReviewRow label="Setup Mode" value={isBasicMode ? "Basic & Quick" : "Full Setup"} />
                            <ReviewRow label="Agent Name" value={answers.agentName || "—"} />
                            <ReviewRow label="Channels" value={answers.channels?.join(", ") || "—"} />
                            <ReviewRow
                                label="AI Provider"
                                value={`${PROVIDER_DISPLAY[answers.aiProvider as AIProvider]?.name || answers.aiProvider} · ${answers.modelName}`}
                            />
                            {!isBasicMode && answers.enabledTools && answers.enabledTools.length > 0 && (
                                <ReviewRow
                                    label="Tools"
                                    value={answers.enabledTools.map((t) =>
                                        OPENCLAW_TOOLS[t as keyof typeof OPENCLAW_TOOLS]?.name || t
                                    ).join(", ")}
                                />
                            )}
                            {!isBasicMode && answers.enabledSkills && answers.enabledSkills.length > 0 && (
                                <ReviewRow
                                    label="Skills"
                                    value={answers.enabledSkills.map((s) =>
                                        OPENCLAW_SKILLS[s as keyof typeof OPENCLAW_SKILLS]?.name || s
                                    ).join(", ")}
                                />
                            )}
                            <ReviewRow label="Your Role" value={answers.occupation || "—"} />
                            <ReviewRow label="Style" value={answers.communicationStyle || "—"} />
                            {!isBasicMode && (
                                <ReviewRow label="Cron Jobs" value={answers.enabledCrons?.length ? `${answers.enabledCrons.length} scheduled` : "None"} />
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm">
                                {error}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
                <button onClick={goPrev} disabled={step === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" /> Back
                </button>

                {step < STEPS.length - 1 ? (
                    <button onClick={goNext} className="btn-primary flex items-center gap-2">
                        Continue <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button onClick={deploy} disabled={deploying} className="btn-primary flex items-center gap-2">
                        {deploying ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Deploying…
                            </>
                        ) : (
                            <>
                                <Rocket className="w-4 h-4" /> Deploy Agent
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-text-muted text-sm">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}
