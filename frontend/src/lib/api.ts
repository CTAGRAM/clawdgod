// ──────────────────────────────────────────────────────────────
// ClawdGod — API Client
// Typed fetch wrapper with JWT auto-refresh
// ──────────────────────────────────────────────────────────────

// Empty string = same-origin (combined deploy via Next.js rewrites)
// Set NEXT_PUBLIC_API_URL for split deploys (e.g. separate backend service)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
    accessToken = token;
    if (token) {
        localStorage.setItem("clawdgod_token", token);
    } else {
        localStorage.removeItem("clawdgod_token");
    }
}

export function getAccessToken(): string | null {
    if (accessToken) return accessToken;
    if (typeof window !== "undefined") {
        accessToken = localStorage.getItem("clawdgod_token");
    }
    return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
    try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
        });
        if (!res.ok) return null;
        const data = await res.json();
        setAccessToken(data.accessToken);
        return data.accessToken;
    } catch {
        return null;
    }
}

export async function api<T = any>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getAccessToken();

    const headers: Record<string, string> = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
    });

    // If 401, try refreshing
    if (res.status === 401 && token) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            headers.Authorization = `Bearer ${newToken}`;
            res = await fetch(`${API_URL}${path}`, {
                ...options,
                headers,
                credentials: "include",
            });
        }
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || res.statusText);
    }

    return res.json();
}
