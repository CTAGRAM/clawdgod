"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
    Bot,
    ArrowLeft,
    RefreshCw,
    Trash2,
    Send,
    Phone,
    Gamepad2,
    Activity,
    MessageSquare,
    Clock,
    Loader2,
    Circle,
    Brain,
    Zap,
    Shield,
    Terminal,
    AlertTriangle,
    ExternalLink,
    Globe,
    Copy,
    Check,
} from "lucide-react";

interface AgentDetail {
    id: string;
    name: string;
    status: string;
    openclawVersion: string;
    containerId: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ProviderInfo {
    provider: string;
    modelName: string;
    baseUrl: string | null;
}

interface ChannelInfo {
    id: string;
    channelType: string;
    status: string;
    lastActivityAt: string | null;
    messageCountToday: number | null;
}

const channelIcons: Record<string, typeof Send> = {
    telegram: Send,
    whatsapp: Phone,
    discord: Gamepad2,
};

const channelNames: Record<string, string> = {
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    discord: "Discord",
};

const statusConfig: Record<string, { color: string; badge: string; glow: string }> = {
    active: { color: "text-accent-green", badge: "badge-green", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]" },
    provisioning: { color: "text-accent-blue", badge: "badge-blue", glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]" },
    restarting: { color: "text-accent-yellow", badge: "badge-yellow", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]" },
    offline: { color: "text-accent-red", badge: "badge-red", glow: "" },
    stopped: { color: "text-accent-red", badge: "badge-red", glow: "" },
};

export default function AgentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [agent, setAgent] = useState<AgentDetail | null>(null);
    const [provider, setProvider] = useState<ProviderInfo | null>(null);
    const [channels, setChannels] = useState<ChannelInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [copied, setCopied] = useState(false);


    const fetchData = async () => {
        try {
            const data = await api(`/api/agents/${id}`);
            setAgent(data.agent);
            setProvider(data.provider);
            setChannels(data.channels || []);
        } catch (err) {
            console.error("Failed to fetch agent:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [id]);

    const handleRestart = async () => {
        setActionLoading("restart");
        try {
            await api(`/api/agents/${id}/restart`, { method: "POST" });
            await fetchData();
        } catch (err) {
            console.error("Restart failed:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
        setActionLoading("delete");
        try {
            await api(`/api/agents/${id}`, { method: "DELETE" });
            router.push("/dashboard");
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const copyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Derive gateway URL from containerId (format: "ip:port")
    const gatewayUrl = agent?.containerId?.includes(":")
        ? `http://${agent.containerId}`
        : null;
    // Auth URL includes token so Control UI connects without manual token entry
    const gatewayAuthUrl = gatewayUrl && agent ? `${gatewayUrl}/?token=${agent.id}` : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <AlertTriangle className="w-12 h-12 text-accent-yellow" />
                <h2 className="text-xl font-semibold">Agent not found</h2>
                <Link href="/dashboard" className="btn-primary">
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const config = statusConfig[agent.status] || statusConfig.offline;

    // Derive effective channel status from agent status
    const effectiveChannelStatus = (ch: ChannelInfo) => {
        if (agent.status === "active") return "active";
        if (agent.status === "provisioning") return "connecting";
        return ch.status;
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <Link
                    href="/dashboard"
                    className="p-2 rounded-xl hover:bg-surface transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-text-muted" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{agent.name}</h1>
                            <p className="text-text-muted text-sm">
                                v{agent.openclawVersion} · Created{" "}
                                {new Date(agent.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
                <span className={config.badge}>
                    <Circle className="w-2 h-2 fill-current" />
                    {agent.status}
                </span>
            </div>

            {/* Status Banner for provisioning */}
            {agent.status === "provisioning" && (
                <div className="glass-card p-4 border-accent-blue/20 bg-accent-blue/5 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-accent-blue" />
                    <div>
                        <p className="font-medium text-sm">Provisioning in progress</p>
                        <p className="text-text-muted text-xs">
                            Your agent is being set up on the VPS. This usually takes 30-60 seconds.
                        </p>
                    </div>
                </div>
            )}

            {/* Live URL Banner — prominent when agent is active */}
            {gatewayUrl && agent.status === "active" && (
                <div className="glass-card p-5 border-accent-green/20 bg-accent-green/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-green/10 flex items-center justify-center shrink-0">
                            <Globe className="w-5 h-5 text-accent-green" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-accent-green mb-1">Agent Live</p>
                            <div className="flex items-center gap-2">
                                <code className="text-sm font-mono bg-surface/80 px-3 py-1 rounded-lg truncate">
                                    {gatewayUrl}
                                </code>
                                <button
                                    onClick={() => copyUrl(gatewayAuthUrl!)}
                                    className="p-1.5 rounded-lg hover:bg-surface transition-colors shrink-0"
                                    title="Copy URL"
                                >
                                    {copied ? (
                                        <Check className="w-4 h-4 text-accent-green" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-text-muted" />
                                    )}
                                </button>
                                <a
                                    href={gatewayAuthUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg hover:bg-surface transition-colors shrink-0"
                                    title="Open Control UI"
                                >
                                    <ExternalLink className="w-4 h-4 text-text-muted" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column — Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* AI Provider Card */}
                    {provider && (
                        <div className={`glass-card p-6 ${config.glow}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center">
                                    <Brain className="w-5 h-5 text-accent-purple" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">AI Provider</h3>
                                    <p className="text-text-muted text-sm">Powers your agent&apos;s intelligence</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem label="Provider" value={provider.provider} />
                                <InfoItem label="Model" value={provider.modelName} />
                                {provider.baseUrl && (
                                    <InfoItem
                                        label="Base URL"
                                        value={provider.baseUrl}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Channels Card */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-accent-blue" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Connected Channels</h3>
                                <p className="text-text-muted text-sm">
                                    {channels.length} channel{channels.length !== 1 ? "s" : ""} configured
                                </p>
                            </div>
                        </div>
                        {channels.length === 0 ? (
                            <p className="text-text-muted text-sm py-4">No channels configured yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {channels.map((ch) => {
                                    const Icon = channelIcons[ch.channelType] || MessageSquare;
                                    const effStatus = effectiveChannelStatus(ch);
                                    const chConfig = statusConfig[effStatus] || statusConfig.offline;
                                    return (
                                        <div
                                            key={ch.id}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-surface/50 border border-border/30"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Icon className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">
                                                    {channelNames[ch.channelType] || ch.channelType}
                                                </p>
                                                <p className="text-text-muted text-xs">
                                                    {ch.lastActivityAt
                                                        ? `Last active: ${new Date(ch.lastActivityAt).toLocaleString()}`
                                                        : "No activity yet"}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className={chConfig.badge + " text-xs"}>
                                                    <Circle className="w-1.5 h-1.5 fill-current" />
                                                    {effStatus}
                                                </span>
                                                {ch.messageCountToday != null && ch.messageCountToday > 0 && (
                                                    <p className="text-text-muted text-xs mt-1">
                                                        {ch.messageCountToday} today
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>


                    {/* Runtime Info */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-accent-green/10 flex items-center justify-center">
                                <Terminal className="w-5 h-5 text-accent-green" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Runtime</h3>
                                <p className="text-text-muted text-sm">Agent deployment info</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InfoItem
                                label="Host"
                                value={agent.containerId?.split(":")[0] || "Not assigned"}
                            />
                            <InfoItem label="OpenClaw" value={`v${agent.openclawVersion}`} />
                            <InfoItem
                                label="Gateway Port"
                                value={agent.containerId?.split(":")[1] || "—"}
                            />
                            <InfoItem
                                label="Last Updated"
                                value={new Date(agent.updatedAt).toLocaleString()}
                            />
                        </div>
                        {gatewayUrl && (
                            <div className="mt-4 pt-4 border-t border-border/30">
                                <a
                                    href={gatewayAuthUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Open Control UI
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column — Actions */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="glass-card p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" /> Actions
                        </h3>
                        <div className="space-y-3">
                            {gatewayUrl && (
                                <a
                                    href={gatewayAuthUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm no-underline"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Open Control UI
                                </a>
                            )}

                            <button
                                onClick={handleRestart}
                                disabled={actionLoading !== null || agent.status === "provisioning"}
                                className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                {actionLoading === "restart" ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                Restart Agent
                            </button>

                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={actionLoading !== null}
                                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-accent-red/20 text-accent-red hover:bg-accent-red/5 transition-all text-sm font-medium disabled:opacity-40"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Agent
                            </button>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="glass-card p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-accent-green" /> Security
                        </h3>
                        <div className="space-y-3 text-sm text-text-secondary">
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent-green mt-1.5 shrink-0" />
                                <span>API key encrypted with AES-256-GCM</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent-green mt-1.5 shrink-0" />
                                <span>Isolated process with systemd sandboxing</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent-green mt-1.5 shrink-0" />
                                <span>Gateway protected with token auth</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="glass-card p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-accent-blue" /> Stats
                        </h3>
                        <div className="space-y-3">
                            <MiniStat label="Channels" value={channels.length.toString()} />
                            <MiniStat
                                label="Messages Today"
                                value={channels.reduce((sum, c) => sum + (c.messageCountToday || 0), 0).toString()}
                            />
                            <MiniStat
                                label="Uptime"
                                value={agent.status === "active" ? "Online" : agent.status}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card p-8 max-w-md w-full mx-4">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-accent-red/10 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-accent-red" />
                        </div>
                        <h3 className="text-lg font-semibold text-center mb-2">Delete {agent.name}?</h3>
                        <p className="text-text-secondary text-sm text-center mb-6">
                            This will permanently stop the agent and remove all associated data.
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={actionLoading === "delete"}
                                className="flex-1 p-3 rounded-xl bg-accent-red text-white font-medium text-sm hover:bg-accent-red/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {actionLoading === "delete" ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-text-muted text-xs mb-0.5">{label}</p>
            <p className="text-sm font-medium truncate">{value}</p>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
            <span className="text-text-muted text-sm">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}
