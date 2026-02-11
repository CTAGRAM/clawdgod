"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAgentStore } from "@/lib/store";
import {
    Bot,
    Plus,
    ArrowRight,
    Circle,
    Globe,
} from "lucide-react";

export default function MyAgentsPage() {
    const { agents, isLoading, fetchAgents } = useAgentStore();

    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    const statusBadge: Record<string, string> = {
        active: "badge-green",
        provisioning: "badge-blue",
        restarting: "badge-yellow",
        offline: "badge-red",
        stopped: "badge-red",
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">My Agents</h1>
                    <p className="text-text-secondary mt-1">
                        {agents.length} agent{agents.length !== 1 ? "s" : ""} deployed
                    </p>
                </div>
                <Link href="/dashboard/agents/new" className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Deploy Agent
                </Link>
            </div>

            {!isLoading && agents.length === 0 && (
                <div className="glass-card p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Bot className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No agents yet</h2>
                    <p className="text-text-secondary mb-6 max-w-md mx-auto">
                        Deploy your first AI agent in under 60 seconds.
                    </p>
                    <Link href="/dashboard/agents/new" className="btn-primary inline-flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Get Started
                    </Link>
                </div>
            )}

            {agents.length > 0 && (
                <div className="space-y-3">
                    {agents.map((agent) => {
                        const gatewayUrl = agent.containerId?.includes(":")
                            ? `http://${agent.containerId}`
                            : null;
                        return (
                            <Link
                                key={agent.id}
                                href={`/dashboard/agents/${agent.id}`}
                                className="glass-card p-5 flex items-center gap-4 hover:border-primary/30 transition-all duration-300 group cursor-pointer"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                    <Bot className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold">{agent.name}</h3>
                                        <span className={statusBadge[agent.status] || "badge-blue"}>
                                            <Circle className="w-1.5 h-1.5 fill-current" />
                                            {agent.status}
                                        </span>
                                    </div>
                                    <p className="text-text-muted text-sm">
                                        v{agent.openclawVersion}
                                        {gatewayUrl && (
                                            <span className="ml-2 inline-flex items-center gap-1 text-text-secondary">
                                                <Globe className="w-3 h-3" />
                                                {agent.containerId}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
