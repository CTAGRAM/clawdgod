import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "ClawdGod — Your AI Agent, Deployed in 60 Seconds",
    description:
        "The secure, managed way to run your OpenClaw AI agent. Deploy to Telegram, WhatsApp, and Discord without writing a single line of code.",
    keywords: ["AI agent", "OpenClaw", "Telegram bot", "WhatsApp bot", "Discord bot", "managed hosting"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <head>
                <link rel="icon" href="/favicon.ico" />
            </head>
            <body className="min-h-screen bg-background">{children}</body>
        </html>
    );
}
