"use client";

import { useEffect, useState } from "react";
import { useSubscriptionStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
    CreditCard,
    Zap,
    CheckCircle2,
    ExternalLink,
    Sparkles,
    Crown,
    Loader2,
    ArrowUpRight,
    X,
} from "lucide-react";
import { PLAN_LIMITS, PLAN_PRICES } from "@clawdgod/shared";

type PlanKey = "starter" | "pro" | "builder";

const PLAN_FEATURES: Record<PlanKey, string[]> = {
    starter: [
        `${PLAN_LIMITS.starter.maxAgents} agent`,
        `${PLAN_LIMITS.starter.maxChannels} channel`,
        `${PLAN_LIMITS.starter.maxTasksPerMonth} tasks/month`,
        `${PLAN_LIMITS.starter.maxCronJobs} cron jobs`,
        "7-day task history",
        "Shared VPS node",
    ],
    pro: [
        `${PLAN_LIMITS.pro.maxAgents} agents`,
        `${PLAN_LIMITS.pro.maxChannels} channels`,
        "Unlimited tasks/month",
        `${PLAN_LIMITS.pro.maxCronJobs} cron jobs`,
        "Full task history",
        "Dedicated VPS node",
        "Advanced skills",
        "API access",
    ],
    builder: [
        `${PLAN_LIMITS.builder.maxAgents} agents`,
        `${PLAN_LIMITS.builder.maxChannels} channels`,
        "Unlimited tasks/month",
        `${PLAN_LIMITS.builder.maxCronJobs} cron jobs`,
        "Full task history",
        "Dedicated VPS node",
        "Advanced skills",
        "API access",
        "Priority support",
    ],
};

const PLAN_DISPLAY: Record<PlanKey, { name: string; icon: typeof Sparkles; color: string }> = {
    starter: { name: "Starter", icon: Sparkles, color: "text-accent-blue" },
    pro: { name: "Pro", icon: Zap, color: "text-accent-purple" },
    builder: { name: "Builder", icon: Crown, color: "text-primary" },
};

export default function BillingPage() {
    const { user } = useAuthStore();
    const { plan, status, isLoading: subLoading, fetchSubscription, createCheckout } = useSubscriptionStore();
    const [agentCount, setAgentCount] = useState(0);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchSubscription();
        // Get agent count for usage bar
        api("/api/agents")
            .then((data) => setAgentCount(data.agents?.length || 0))
            .catch(() => { });
    }, [fetchSubscription]);

    const currentPlan: PlanKey = (plan as PlanKey) || "starter";
    const currentLimits = PLAN_LIMITS[currentPlan];
    const currentFeatures = PLAN_FEATURES[currentPlan];
    const CurrentIcon = PLAN_DISPLAY[currentPlan].icon;

    const handleUpgrade = async (targetPlan: PlanKey) => {
        setCheckoutLoading(targetPlan);
        try {
            const url = await createCheckout(targetPlan);
            if (url) window.open(url, "_blank");
        } catch (err) {
            console.error("Checkout failed:", err);
        } finally {
            setCheckoutLoading(null);
        }
    };

    if (subLoading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const isUpgradable = currentPlan !== "builder";

    return (
        <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Billing</h1>
                <p className="text-text-secondary mt-1">Manage your subscription and plan.</p>
            </div>

            {/* Current Plan */}
            <div className={`glass-card p-6 ${currentPlan !== "starter" ? "border-primary/30 shadow-glow" : ""}`}>
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${currentPlan !== "starter" ? "bg-primary/10" : "bg-surface"}`}>
                        <CurrentIcon className={`w-7 h-7 ${PLAN_DISPLAY[currentPlan].color}`} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold">{PLAN_DISPLAY[currentPlan].name} Plan</h2>
                            <span className={currentPlan !== "starter" ? "badge-green" : "badge-blue"}>
                                {status || "active"}
                            </span>
                        </div>
                        <p className="text-text-muted text-sm">
                            ${(PLAN_PRICES[currentPlan] / 100).toFixed(0)}/month
                            {currentPlan !== "starter" && " · Full access to all features"}
                        </p>
                    </div>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                    {currentFeatures.map((feature) => (
                        <div key={feature} className="flex items-center gap-3 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-accent-green shrink-0" />
                            <span>{feature}</span>
                        </div>
                    ))}
                </div>

                {/* Agent Usage */}
                <div className="p-4 rounded-xl bg-surface/80 border border-border/30">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-text-muted">Agent Usage</span>
                        <span className="text-sm font-medium">
                            {agentCount} / {currentLimits.maxAgents}
                        </span>
                    </div>
                    <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{
                                width: `${Math.min(
                                    (agentCount / currentLimits.maxAgents) * 100,
                                    100
                                )}%`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Upgrade Options */}
            {isUpgradable && (
                <div>
                    <h3 className="font-semibold mb-4">Upgrade Your Plan</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(["pro", "builder"] as PlanKey[])
                            .filter((p) => {
                                const order: Record<PlanKey, number> = { starter: 0, pro: 1, builder: 2 };
                                return order[p] > order[currentPlan];
                            })
                            .map((planKey) => {
                                const planInfo = PLAN_DISPLAY[planKey];
                                const PlanIcon = planInfo.icon;
                                const features = PLAN_FEATURES[planKey];
                                const price = PLAN_PRICES[planKey];

                                return (
                                    <div key={planKey} className="glass-card p-6 border-primary/20 bg-primary/5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <PlanIcon className={`w-5 h-5 ${planInfo.color}`} />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{planInfo.name}</h4>
                                                <p className="text-text-muted text-sm">${(price / 100).toFixed(0)}/mo</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mb-5">
                                            {features.slice(0, 5).map((f) => (
                                                <div key={f} className="flex items-center gap-2 text-sm">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-green shrink-0" />
                                                    <span className="text-text-secondary">{f}</span>
                                                </div>
                                            ))}
                                            {features.length > 5 && (
                                                <p className="text-xs text-text-muted">+{features.length - 5} more features</p>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleUpgrade(planKey)}
                                            disabled={checkoutLoading !== null}
                                            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                                        >
                                            {checkoutLoading === planKey ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <ArrowUpRight className="w-4 h-4" />
                                            )}
                                            Upgrade to {planInfo.name}
                                        </button>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Payment Info */}
            <div className="glass-card p-5 flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-text-muted" />
                <p className="text-sm text-text-secondary flex-1">
                    Payments are handled securely through Polar.sh.
                </p>
                <a
                    href="https://polar.sh/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm flex items-center gap-1 hover:underline"
                >
                    Manage Subscription <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
}
