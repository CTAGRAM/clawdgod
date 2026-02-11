"use client";

import {
    Shield,
    Lock,
    Key,
    Eye,
    Server,
    CheckCircle2,
    AlertTriangle,
    Info,
} from "lucide-react";

const securityChecks = [
    {
        label: "API keys encrypted at rest",
        description: "All provider API keys are encrypted with AES-256-GCM before storage.",
        status: "pass",
        icon: Key,
    },
    {
        label: "Gateway token authentication",
        description: "Each agent gateway requires a unique token for access.",
        status: "pass",
        icon: Lock,
    },
    {
        label: "Process isolation",
        description: "Agents run as isolated systemd services with separate state directories.",
        status: "pass",
        icon: Server,
    },
    {
        label: "Encrypted transport",
        description: "HTTPS recommended for production. Currently using HTTP.",
        status: "warning",
        icon: Eye,
    },
];

const statusIcon: Record<string, { Icon: typeof CheckCircle2; class: string }> = {
    pass: { Icon: CheckCircle2, class: "text-accent-green" },
    warning: { Icon: AlertTriangle, class: "text-accent-yellow" },
    fail: { Icon: AlertTriangle, class: "text-accent-red" },
};

export default function SecurityPage() {
    const passCount = securityChecks.filter((c) => c.status === "pass").length;
    const total = securityChecks.length;

    return (
        <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Security</h1>
                <p className="text-text-secondary mt-1">
                    Security posture and encryption status for your agents.
                </p>
            </div>

            {/* Score Card */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-accent-green/10 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-accent-green" />
                    </div>
                    <div>
                        <p className="text-3xl font-bold">{passCount}/{total}</p>
                        <p className="text-text-muted text-sm">Security checks passing</p>
                    </div>
                    <div className="ml-auto">
                        <span className={passCount === total ? "badge-green" : "badge-yellow"}>
                            {passCount === total ? "All Clear" : "Action Needed"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Checks */}
            <div className="space-y-3">
                {securityChecks.map((check) => {
                    const { Icon, class: iconClass } = statusIcon[check.status] || statusIcon.pass;
                    return (
                        <div
                            key={check.label}
                            className="glass-card p-5 flex items-start gap-4"
                        >
                            <div className={`mt-0.5 shrink-0 ${iconClass}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <check.icon className="w-4 h-4 text-text-muted" />
                                    <h3 className="font-semibold text-sm">{check.label}</h3>
                                </div>
                                <p className="text-text-muted text-sm">{check.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Info Note */}
            <div className="glass-card p-4 border-accent-blue/20 bg-accent-blue/5 flex items-start gap-3">
                <Info className="w-5 h-5 text-accent-blue shrink-0 mt-0.5" />
                <p className="text-sm text-text-secondary">
                    Agent credentials are never stored in plain text. API keys are encrypted with
                    AES-256-GCM and decrypted only at deploy time. Gateway tokens protect the
                    control UI from unauthorized access.
                </p>
            </div>
        </div>
    );
}
