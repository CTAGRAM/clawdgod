"use client";

import {
    Puzzle,
    Send,
    Globe,
    Search,
    Calendar,
    FileText,
    Code,
    Newspaper,
    Lock,
} from "lucide-react";

const skills = [
    {
        name: "Web Search",
        description: "Search the web for real-time information using Google or Bing.",
        icon: Search,
        status: "available",
        category: "Research",
    },
    {
        name: "Web Browsing",
        description: "Visit and extract content from any website or URL.",
        icon: Globe,
        status: "available",
        category: "Research",
    },
    {
        name: "Calendar Management",
        description: "Create, update, and manage Google Calendar events.",
        icon: Calendar,
        status: "coming_soon",
        category: "Productivity",
    },
    {
        name: "Document Generation",
        description: "Create PDFs, reports, and formatted documents.",
        icon: FileText,
        status: "available",
        category: "Productivity",
    },
    {
        name: "Code Execution",
        description: "Run Python, JavaScript, and shell scripts in a sandbox.",
        icon: Code,
        status: "available",
        category: "Development",
    },
    {
        name: "News & RSS",
        description: "Monitor news feeds and get summarized updates.",
        icon: Newspaper,
        status: "coming_soon",
        category: "Information",
    },
    {
        name: "Telegram Bot",
        description: "Full Telegram bot integration with inline keyboards.",
        icon: Send,
        status: "active",
        category: "Channels",
    },
    {
        name: "Encrypted Storage",
        description: "Store and retrieve encrypted notes and credentials.",
        icon: Lock,
        status: "coming_soon",
        category: "Security",
    },
];

const statusBadges: Record<string, { class: string; label: string }> = {
    active: { class: "badge-green", label: "Active" },
    available: { class: "badge-blue", label: "Available" },
    coming_soon: { class: "badge-purple", label: "Coming Soon" },
};

export default function SkillsPage() {
    const categories = [...new Set(skills.map((s) => s.category))];

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Skills</h1>
                <p className="text-text-secondary mt-1">
                    Capabilities your agents can use. Skills are auto-loaded based on your config.
                </p>
            </div>

            {categories.map((category) => (
                <div key={category}>
                    <h2 className="text-lg font-semibold mb-3 text-text-secondary">{category}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {skills
                            .filter((s) => s.category === category)
                            .map((skill) => {
                                const badge = statusBadges[skill.status] || statusBadges.available;
                                return (
                                    <div
                                        key={skill.name}
                                        className={`glass-card p-5 transition-all duration-300 ${skill.status === "coming_soon" ? "opacity-60" : "hover:border-primary/30"
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                                <skill.icon className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-sm">{skill.name}</h3>
                                                    <span className={badge.class + " text-xs"}>
                                                        {badge.label}
                                                    </span>
                                                </div>
                                                <p className="text-text-muted text-sm">
                                                    {skill.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ))}
        </div>
    );
}
