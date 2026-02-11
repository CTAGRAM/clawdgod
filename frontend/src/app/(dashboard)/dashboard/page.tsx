"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAgentStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
    Bot,
    Plus,
    Activity,
    MessageSquare,
    Clock,
    Zap,
    TrendingUp,
    ArrowRight,
    Circle,
} from "lucide-react";

interface TaskStats {
    today: number;
    thisWeek: number;
    total: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
}

export default function DashboardPage() {
    const { agents, isLoading, startPolling, stopPolling } = useAgentStore();
    const [stats, setStats] = useState<TaskStats | null>(null);

    useEffect(() => {
        startPolling();
        return () => stopPolling();
    }, [startPolling, stopPolling]);

    useEffect(() => {
        if (agents.length > 0) {
            // Fetch stats for the first agent
            api(`/api/agents/${agents[0].id}/tasks/stats`)
                .then((data) => setStats(data.stats))
                .catch(() => { });
        }
    }, [agents]);

    const primaryAgent = agents[0];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-text-secondary mt-1">
                        {agents.length > 0
                            ? `Managing ${agents.length} agent${agents.length > 1 ? "s" : ""}`
                            : "Deploy your first AI agent"}
                    </p>
                </div>
                <Link href="/dashboard/agents/new" className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Deploy Agent
                </Link>
            </div>

            {/* No agents state */}
            {!isLoading && agents.length === 0 && (
                <div className="glass-card p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No agents yet</h2>
                    <p className="text-text-secondary mb-6 max-w-md mx-auto">
                        Deploy your personalized AI agent in under 60 seconds. It'll connect to
                        Telegram, WhatsApp, or Discord and start helping you right away.
                    </p>
                    <Link href="/dashboard/agents/new" className="btn-primary inline-flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Start Setup Wizard
                    </Link>
                </div>
            )}

            {/* Stats Grid */}
            {primaryAgent && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={<Activity className="w-5 h-5" />}
                        label="Tasks Today"
                        value={stats?.today ?? "-"}
                        accent="blue"
                    />
                    <StatCard
                        icon={<TrendingUp className="w-5 h-5" />}
                        label="This Week"
                        value={stats?.thisWeek ?? "-"}
                        accent="green"
                    />
                    <StatCard
                        icon={<MessageSquare className="w-5 h-5" />}
                        label="Total Tasks"
                        value={stats?.total ?? "-"}
                        accent="purple"
                    />
                    <StatCard
                        icon={<Clock className="w-5 h-5" />}
                        label="Status"
                        value={primaryAgent.status}
                        accent={primaryAgent.status === "active" ? "green" : "yellow"}
                        isStatus
                    />
                </div>
            )}

            {/* Agent Cards */}
            {agents.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-4">Your Agents</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {agents.map((agent) => (
                            <Link
                                key={agent.id}
                                href={`/dashboard/agents/${agent.id}`}
                                className="glass-card p-6 hover:border-primary/30 transition-all duration-300 group"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Bot className="w-5 h-5 text-primary" />
                                    </div>
                                    <StatusBadge status={agent.status} />
                                </div>
                                <h3 className="font-semibold text-lg mb-1">{agent.name}</h3>
                                <p className="text-text-muted text-sm">v{agent.openclawVersion}</p>
                                <div className="mt-4 flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                    View Details <ArrowRight className="w-3 h-3" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    accent,
    isStatus,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    accent: "blue" | "green" | "purple" | "yellow";
    isStatus?: boolean;
}) {
    const colorMap = {
        blue: "text-accent-blue bg-accent-blue/10",
        green: "text-accent-green bg-accent-green/10",
        purple: "text-accent-purple bg-accent-purple/10",
        yellow: "text-accent-yellow bg-accent-yellow/10",
    };

    return (
        <div className="glass-card p-5">
            <div className={`w-10 h-10 rounded-xl ${colorMap[accent]} flex items-center justify-center mb-3`}>
                {icon}
            </div>
            <p className="text-text-muted text-sm">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${isStatus ? "text-base capitalize" : ""}`}>
                {value}
            </p>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        active: "badge-green",
        provisioning: "badge-blue",
        restarting: "badge-yellow",
        offline: "badge-red",
        stopped: "badge-red",
    };

    return (
        <span className={map[status] || "badge-blue"}>
            <Circle className="w-2 h-2 fill-current" />
            {status}
        </span>
    );
}
