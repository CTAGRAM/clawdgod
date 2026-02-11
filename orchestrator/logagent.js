#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// ClawdGod — Log Agent
// Runs inside each OpenClaw container as a sidecar process.
// Parses OpenClaw's structured JSON logs and forwards task events
// to the ClawdGod orchestrator.
// 
// Per PRD Appendix B — injected into container at init.
// ──────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const ORCHESTRATOR_URL = process.env.CLAWDGOD_ORCHESTRATOR_URL || "http://orchestrator:3002";
const AGENT_ID = process.env.CLAWDGOD_AGENT_ID;
const INTERNAL_TOKEN = process.env.CLAWDGOD_INTERNAL_TOKEN;

if (!AGENT_ID) {
    console.error("[LogAgent] CLAWDGOD_AGENT_ID not set, exiting");
    process.exit(1);
}

// Watch the OpenClaw log directory for new log files
const LOG_DIR = process.env.OPENCLAW_LOG_DIR || "/home/clawdgod/.openclaw/logs";

async function sendEvent(event, data) {
    try {
        await fetch(`${ORCHESTRATOR_URL}/internal/task-events`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-token": INTERNAL_TOKEN || "",
            },
            body: JSON.stringify({
                agentId: AGENT_ID,
                event,
                data,
            }),
        });
    } catch (err) {
        console.error(`[LogAgent] Failed to send event ${event}:`, err.message);
    }
}

function parseLine(line) {
    try {
        const entry = JSON.parse(line);

        // Map OpenClaw log events to ClawdGod task events
        if (entry.type === "task_start" || entry.event === "task.start") {
            sendEvent("task.started", {
                externalId: entry.taskId || entry.id || crypto.randomUUID(),
                summary: entry.prompt || entry.message || "",
            });
        } else if (entry.type === "tool_call" || entry.event === "tool.called") {
            sendEvent("task.step", {
                externalId: entry.taskId || entry.id,
                step: {
                    type: entry.tool || entry.toolName || "unknown",
                    input: typeof entry.input === "string" ? entry.input : JSON.stringify(entry.input),
                    output: typeof entry.output === "string" ? entry.output : JSON.stringify(entry.output || ""),
                    timestamp: entry.timestamp || new Date().toISOString(),
                },
            });
        } else if (entry.type === "task_complete" || entry.event === "task.complete") {
            sendEvent("task.completed", {
                externalId: entry.taskId || entry.id,
                tokensUsed: entry.tokensUsed || entry.tokens || 0,
                durationMs: entry.durationMs || entry.duration || 0,
            });
        } else if (entry.type === "task_error" || entry.event === "task.error") {
            sendEvent("task.failed", {
                externalId: entry.taskId || entry.id,
                error: entry.error || entry.message || "Unknown error",
            });
        }
    } catch {
        // Not JSON or unrecognized format, skip
    }
}

// Read from stdin (piped from OpenClaw process)
process.stdin.setEncoding("utf8");
let buffer = "";

process.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer
    for (const line of lines) {
        if (line.trim()) parseLine(line);
    }
});

process.stdin.on("end", () => {
    if (buffer.trim()) parseLine(buffer);
});

console.log(`[LogAgent] Started for agent ${AGENT_ID}`);
console.log(`[LogAgent] Forwarding to ${ORCHESTRATOR_URL}`);
