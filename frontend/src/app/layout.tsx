import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
    title: "ClawdGod — Your AI Agent, Deployed in 60 Seconds",
    description:
        "The secure, managed way to run your OpenClaw AI agent. Deploy to Telegram, WhatsApp, and Discord without writing a single line of code.",
    keywords: ["AI agent", "OpenClaw", "Telegram bot", "WhatsApp bot", "Discord bot", "managed hosting"],
    icons: {
        icon: "/favicon.ico",
        apple: "/apple-icon.png",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen bg-background">{children}</body>
            <Script
                src="https://datafa.st/js/script.js"
                data-website-id="dfid_vEWM3uLbnu65nlRiFEyDL"
                data-domain="clawdgod.astitwa.ai"
                strategy="afterInteractive"
            />
        </html>
    );
}
