"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { useAuthStore } from "@/lib/store";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    renderButton: (element: HTMLElement, config: any) => void;
                };
            };
        };
    }
}

export default function LoginPage() {
    const router = useRouter();
    const login = useAuthStore((s) => s.login);
    const googleLogin = useAuthStore((s) => s.googleLogin);
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(form.email, form.password);
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleCallback = useCallback(async (response: any) => {
        setError("");
        setLoading(true);
        try {
            await googleLogin(response.credential);
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Google login failed");
        } finally {
            setLoading(false);
        }
    }, [googleLogin, router]);

    const initializeGoogle = useCallback(() => {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId || !window.google) return;

        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCallback,
        });

        const btnContainer = document.getElementById("google-signin-btn");
        if (btnContainer) {
            window.google.accounts.id.renderButton(btnContainer, {
                theme: "filled_black",
                size: "large",
                width: "100%",
                shape: "pill",
                text: "continue_with",
            });
        }
    }, [handleGoogleCallback]);

    useEffect(() => {
        // If GSI script already loaded
        if (window.google) {
            initializeGoogle();
        }
    }, [initializeGoogle]);

    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            {/* Google Identity Services Script */}
            {googleClientId && (
                <Script
                    src="https://accounts.google.com/gsi/client"
                    strategy="afterInteractive"
                    onLoad={initializeGoogle}
                />
            )}

            {/* Background effects */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-purple/5 rounded-full blur-3xl" />
            </div>

            <div className="glass-card w-full max-w-md p-8 animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent-purple bg-clip-text text-transparent">
                        ClawdGod
                    </h1>
                    <p className="text-text-secondary mt-2">Welcome back</p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 rounded-xl bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm">
                        {error}
                    </div>
                )}

                {/* Google Sign-In */}
                {googleClientId && (
                    <>
                        <div id="google-signin-btn" className="w-full flex justify-center mb-4" />
                        <div className="relative mb-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border/50" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 bg-bg text-text-muted">or continue with email</span>
                            </div>
                        </div>
                    </>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="input-field pl-11"
                            required
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <input
                            type="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="input-field pl-11"
                            required
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Sign In <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-text-secondary text-sm mt-6">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="text-primary hover:text-primary-hover transition-colors">
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}
