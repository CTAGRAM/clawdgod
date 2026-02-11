// ──────────────────────────────────────────────────────────────
// ClawdGod — Zustand Stores
// Auth, agent, and UI state management
// ──────────────────────────────────────────────────────────────

import { create } from "zustand";
import { api, setAccessToken, getAccessToken } from "./api";
import type { User, Agent, PlanType } from "@clawdgod/shared";

// ── Auth Store ──
interface AuthState {
    user: Pick<User, "id" | "email" | "fullName"> | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, fullName: string) => Promise<void>;
    googleLogin: (credential: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    login: async (email, password) => {
        const data = await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        setAccessToken(data.accessToken);
        set({ user: data.user, isAuthenticated: true, isLoading: false });
    },

    register: async (email, password, fullName) => {
        const data = await api("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password, fullName }),
        });
        setAccessToken(data.accessToken);
        set({ user: data.user, isAuthenticated: true, isLoading: false });
    },

    googleLogin: async (credential) => {
        const data = await api("/api/auth/google", {
            method: "POST",
            body: JSON.stringify({ credential }),
        });
        setAccessToken(data.accessToken);
        set({ user: data.user, isAuthenticated: true, isLoading: false });
    },

    logout: async () => {
        try {
            await api("/api/auth/logout", { method: "POST" });
        } catch {
            // Continue even if backend call fails
        }
        setAccessToken(null);
        set({ user: null, isAuthenticated: false, isLoading: false });
    },

    fetchUser: async () => {
        const token = getAccessToken();
        if (!token) {
            set({ isLoading: false });
            return;
        }
        try {
            const data = await api("/api/auth/me");
            set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch {
            setAccessToken(null);
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));

// ── Agent Store ──
let agentPollTimer: ReturnType<typeof setInterval> | null = null;

interface AgentState {
    agents: Agent[];
    currentAgent: Agent | null;
    isLoading: boolean;

    fetchAgents: () => Promise<void>;
    fetchAgent: (id: string) => Promise<void>;
    deleteAgent: (id: string) => Promise<void>;
    restartAgent: (id: string) => Promise<void>;
    startPolling: () => void;
    stopPolling: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
    agents: [],
    currentAgent: null,
    isLoading: false,

    fetchAgents: async () => {
        const wasEmpty = get().agents.length === 0;
        if (wasEmpty) set({ isLoading: true });
        try {
            const data = await api("/api/agents");
            set({ agents: data.agents, isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },

    fetchAgent: async (id) => {
        set({ isLoading: true });
        try {
            const data = await api(`/api/agents/${id}`);
            set({ currentAgent: data.agent, isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },

    deleteAgent: async (id) => {
        // Optimistic removal
        set({ agents: get().agents.filter((a) => a.id !== id) });
        await api(`/api/agents/${id}`, { method: "DELETE" });
    },

    restartAgent: async (id) => {
        // Optimistic status update
        set({
            agents: get().agents.map((a) =>
                a.id === id ? { ...a, status: "restarting" as const } : a
            ),
        });
        await api(`/api/agents/${id}/restart`, { method: "POST" });
    },

    startPolling: () => {
        if (agentPollTimer) return;
        // Fetch immediately, then every 5 seconds
        get().fetchAgents();
        agentPollTimer = setInterval(() => {
            get().fetchAgents();
        }, 5000);
    },

    stopPolling: () => {
        if (agentPollTimer) {
            clearInterval(agentPollTimer);
            agentPollTimer = null;
        }
    },
}));

// ── Subscription Store ──
interface SubscriptionState {
    plan: PlanType | null;
    status: string | null;
    isLoading: boolean;

    fetchSubscription: () => Promise<void>;
    createCheckout: (plan: PlanType) => Promise<string>;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
    plan: null,
    status: null,
    isLoading: false,

    fetchSubscription: async () => {
        set({ isLoading: true });
        try {
            const data = await api("/api/billing/subscription");
            if (data.subscription) {
                set({
                    plan: data.subscription.plan as PlanType,
                    status: data.subscription.status,
                    isLoading: false,
                });
            } else {
                set({ plan: null, status: null, isLoading: false });
            }
        } catch {
            set({ isLoading: false });
        }
    },

    createCheckout: async (plan) => {
        const data = await api("/api/billing/checkout", {
            method: "POST",
            body: JSON.stringify({ plan }),
        });
        return data.checkoutUrl;
    },
}));

// ── Trial Store ──
interface TrialStatus {
    isTrial: boolean;
    hasSubscription: boolean;
    trialStartedAt: string | null;
    trialExpiresAt: string | null;
    trialExpired: boolean;
    deletionAt: string | null;
    trialAgentCreated: boolean;
}

interface TrialState {
    status: TrialStatus | null;
    isLoading: boolean;
    fetchTrialStatus: () => Promise<void>;
}

export const useTrialStore = create<TrialState>((set) => ({
    status: null,
    isLoading: false,

    fetchTrialStatus: async () => {
        set({ isLoading: true });
        try {
            const data = await api("/api/agents/trial-status");
            set({ status: data, isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },
}));
