"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
    Settings as SettingsIcon,
    User,
    Bell,
    Palette,
    Save,
    Check,
    Loader2,
    LogOut,
    AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const [displayName, setDisplayName] = useState(user?.fullName || "");
    const [email] = useState(user?.email || "");

    const handleSave = async () => {
        setSaving(true);
        try {
            // Placeholder for profile update API
            await new Promise((r) => setTimeout(r, 500));
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Save failed:", err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-text-secondary mt-1">Manage your profile and preferences.</p>
            </div>

            {/* Profile */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Profile</h3>
                        <p className="text-text-muted text-sm">Your account information</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-text-muted mb-1.5 block">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="input-field"
                            placeholder="Your name"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-text-muted mb-1.5 block">Email</label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className="input-field opacity-60 cursor-not-allowed"
                        />
                        <p className="text-xs text-text-muted mt-1">Email cannot be changed.</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex items-center gap-2"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saved ? "Saved!" : "Save Changes"}
                    </button>
                </div>
            </div>

            {/* Notifications */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-accent-blue" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Notifications</h3>
                        <p className="text-text-muted text-sm">How you receive updates</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <ToggleRow
                        label="Agent status alerts"
                        description="Get notified when an agent goes offline or restarts"
                        defaultChecked={true}
                    />
                    <ToggleRow
                        label="Weekly usage report"
                        description="Receive a summary of agent activity each week"
                        defaultChecked={false}
                    />
                </div>
            </div>

            {/* Appearance */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center">
                        <Palette className="w-5 h-5 text-accent-purple" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Appearance</h3>
                        <p className="text-text-muted text-sm">Customize the dashboard look</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface border-2 border-primary flex items-center justify-center cursor-pointer">
                        <span className="text-xs font-mono">Dark</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gray-200 border-2 border-border flex items-center justify-center cursor-not-allowed opacity-40">
                        <span className="text-xs font-mono text-gray-800">Lt</span>
                    </div>
                    <p className="text-text-muted text-sm ml-2">Light mode coming soon</p>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="glass-card p-6 border-accent-red/20">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-accent-red/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-accent-red" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-accent-red">Danger Zone</h3>
                        <p className="text-text-muted text-sm">Irreversible actions</p>
                    </div>
                </div>

                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-accent-red/20 text-accent-red hover:bg-accent-red/5 transition-all text-sm font-medium"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>

            {/* Logout Confirm */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-card p-8 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold text-center mb-2">Sign out?</h3>
                        <p className="text-text-secondary text-sm text-center mb-6">
                            Your agents will keep running. You can sign back in anytime.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    logout();
                                    router.push("/login");
                                }}
                                className="flex-1 p-3 rounded-xl bg-accent-red text-white font-medium text-sm hover:bg-accent-red/90 transition-all"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToggleRow({
    label,
    description,
    defaultChecked,
}: {
    label: string;
    description: string;
    defaultChecked: boolean;
}) {
    const [checked, setChecked] = useState(defaultChecked);

    return (
        <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-text-muted text-xs">{description}</p>
            </div>
            <button
                onClick={() => setChecked(!checked)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${checked ? "bg-primary" : "bg-surface-hover"
                    }`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-0"
                        }`}
                />
            </button>
        </div>
    );
}
