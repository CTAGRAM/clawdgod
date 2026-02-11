"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore, useAgentStore, useTrialStore, useSubscriptionStore } from "@/lib/store";
import {
    LayoutDashboard,
    Bot,
    Plus,
    Settings,
    LogOut,
    Shield,
    Puzzle,
    CreditCard,
    Loader2,
    Clock,
    AlertTriangle,
    Trash2,
} from "lucide-react";

const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/agents", icon: Bot, label: "My Agents" },
    { href: "/dashboard/skills", icon: Puzzle, label: "Skills" },
    { href: "/dashboard/security", icon: Shield, label: "Security" },
    { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

function formatTimeLeft(ms: number): string {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function TrialBanner() {
    const { status } = useTrialStore();
    const { createCheckout } = useSubscriptionStore();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    useEffect(() => {
        if (!status?.trialExpiresAt) return;
        const update = () => {
            const remaining = new Date(status.trialExpiresAt!).getTime() - Date.now();
            setTimeLeft(Math.max(0, remaining));
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [status?.trialExpiresAt]);

    if (!status?.isTrial || status.hasSubscription) return null;

    const handleUpgrade = async () => {
        setIsCheckingOut(true);
        try {
            const url = await createCheckout("starter");
            window.location.href = url;
        } catch {
            setIsCheckingOut(false);
        }
    };

    if (status.trialExpired) return null; // Will be handled by TrialPaymentWall

    return (
        <div className="bg-gradient-to-r from-accent-yellow/10 to-accent-orange/10 border border-accent-yellow/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-accent-yellow shrink-0" />
                <span className="text-sm">
                    <span className="font-semibold text-accent-yellow">Free Trial</span>
                    <span className="text-text-secondary ml-2">
                        {timeLeft > 0
                            ? `${formatTimeLeft(timeLeft)} remaining`
                            : "Expired"}
                    </span>
                </span>
            </div>
            <button
                onClick={handleUpgrade}
                disabled={isCheckingOut}
                className="btn-primary text-xs py-1.5 px-4"
            >
                {isCheckingOut ? "Loading…" : "Upgrade Now"}
            </button>
        </div>
    );
}

function TrialPaymentWall() {
    const { status, fetchTrialStatus } = useTrialStore();
    const { createCheckout } = useSubscriptionStore();
    const [deletionTimeLeft, setDeletionTimeLeft] = useState<number>(0);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    useEffect(() => {
        if (!status?.deletionAt) return;
        const update = () => {
            const remaining = new Date(status.deletionAt!).getTime() - Date.now();
            setDeletionTimeLeft(Math.max(0, remaining));
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [status?.deletionAt]);

    // Re-check trial status every 10s (in case user paid in another tab)
    useEffect(() => {
        const timer = setInterval(fetchTrialStatus, 10_000);
        return () => clearInterval(timer);
    }, [fetchTrialStatus]);

    if (!status?.trialExpired || status.hasSubscription) return null;

    const handleUpgrade = async () => {
        setIsCheckingOut(true);
        try {
            const url = await createCheckout("starter");
            window.location.href = url;
        } catch {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full p-8 text-center space-y-6 border-accent-red/20">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-accent-red/10 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-accent-red" />
                </div>

                <div>
                    <h2 className="text-2xl font-bold mb-2">Trial Expired</h2>
                    <p className="text-text-secondary text-sm">
                        Your 1-hour free trial has ended. Your agent has been paused.
                    </p>
                </div>

                <div className="glass-card p-4 bg-accent-red/5 border-accent-red/10">
                    <div className="flex items-center gap-2 justify-center text-accent-red text-sm font-semibold mb-1">
                        <Trash2 className="w-4 h-4" />
                        Account Deletion Countdown
                    </div>
                    <p className="text-2xl font-mono font-bold text-text-primary">
                        {formatTimeLeft(deletionTimeLeft)}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                        Your account and all data will be permanently deleted when the timer reaches zero.
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleUpgrade}
                        disabled={isCheckingOut}
                        className="btn-primary w-full py-3 text-base font-semibold"
                    >
                        {isCheckingOut ? "Redirecting…" : "Subscribe Now — Keep Your Agent"}
                    </button>
                    <p className="text-xs text-text-muted">
                        Plans start at $29/mo. Your agent will resume instantly after payment.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading, isAuthenticated, fetchUser, logout } = useAuthStore();
    const { agents, fetchAgents } = useAgentStore();
    const { fetchTrialStatus } = useTrialStore();

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAgents();
            fetchTrialStatus();
        }
    }, [isAuthenticated, fetchAgents, fetchTrialStatus]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <div className="flex flex-col min-h-screen">
            {/* Trial Banner — fixed at top */}
            <TrialBanner />

            {/* Trial Payment Wall — blocks everything when trial expired */}
            <TrialPaymentWall />

            <div className="flex flex-1">
                {/* Sidebar */}
                <aside className="w-64 bg-surface/50 border-r border-border flex flex-col">
                    {/* Logo */}
                    <div className="p-6 border-b border-border">
                        <Link href="/dashboard">
                            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent-purple bg-clip-text text-transparent">
                                ClawdGod
                            </h1>
                        </Link>
                    </div>

                    {/* Deploy CTA */}
                    <div className="p-4">
                        <Link
                            href="/dashboard/agents/new"
                            className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5"
                        >
                            <Plus className="w-4 h-4" /> Deploy Agent
                        </Link>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 px-3 py-2 space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200
                  ${isActive
                                            ? "bg-primary/10 text-primary border border-primary/20"
                                            : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                                        }`}
                                >
                                    <item.icon className="w-4 h-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User */}
                    <div className="p-4 border-t border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-semibold">
                                {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user?.fullName || "User"}</p>
                                <p className="text-xs text-text-muted truncate">{user?.email}</p>
                            </div>
                            <button
                                onClick={() => {
                                    logout();
                                    router.push("/login");
                                }}
                                className="text-text-muted hover:text-accent-red transition-colors"
                                title="Sign out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                    <div className="p-8">{children}</div>
                </main>
            </div>
        </div>
    );
}
