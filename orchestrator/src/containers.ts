// ──────────────────────────────────────────────────────────────
// ClawdGod — Agent Lifecycle Manager (Native OpenClaw on VPS)
// Uses openclaw CLI + systemd instead of Docker containers
// ──────────────────────────────────────────────────────────────

import { sshExec, sshWriteFile, type SSHConfig } from "./ssh.js";
import type { ContainerCreateRequest } from "@clawdgod/shared";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const INTERNAL_TOKEN = process.env.INTERNAL_API_SECRET || "";

// Each agent gets a unique port starting from this base
const BASE_GATEWAY_PORT = 18800;

/**
 * Notify backend of agent status change.
 */
async function notifyBackend(agentId: string, status: string, extra?: Record<string, any>) {
    try {
        await fetch(`${BACKEND_URL}/internal/agents/${agentId}/status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-token": INTERNAL_TOKEN,
            },
            body: JSON.stringify({ status, ...extra }),
        });
    } catch (err) {
        console.error(`Failed to notify backend for agent ${agentId}:`, err);
    }
}

/**
 * Compute a deterministic port for an agent based on its ID.
 * Uses a hash of the agentId to spread ports across a range.
 */
function agentPort(agentId: string): number {
    let hash = 0;
    for (const ch of agentId) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    // Port range: 18800–19799 (1000 agents max per VPS)
    return BASE_GATEWAY_PORT + (Math.abs(hash) % 1000);
}

/**
 * Profile name for agent isolation (openclaw --profile <name>).
 */
function profileName(agentId: string): string {
    return `agent-${agentId}`;
}

/**
 * Systemd service name for an agent.
 */
function serviceName(agentId: string): string {
    return `clawdgod-${agentId}`;
}

/**
 * Create and start a native OpenClaw agent on the VPS.
 *
 * Steps:
 * 1. Create workspace directory
 * 2. Write config files (SOUL.md, USER.md, TOOLS.md, config.json)
 * 3. Set env vars for the agent
 * 4. Create systemd service
 * 5. Start the gateway
 */
export async function createAgent(
    ssh: SSHConfig,
    request: ContainerCreateRequest
): Promise<string> {
    const profile = profileName(request.agentId);
    const port = agentPort(request.agentId);
    const service = serviceName(request.agentId);
    const stateDir = `/root/.openclaw-${profile}`;
    const workspaceDir = `${stateDir}/workspace`;
    const configFile = `${stateDir}/openclaw.json`;

    // 1. Create workspace directory
    await sshExec(ssh, `mkdir -p ${workspaceDir}`);

    // 2. Write personalization files to workspace
    for (const file of request.files) {
        if (file.path === "config.json") {
            // config.json goes to the state dir root as openclaw.json
            // But we need to update workspace path + gateway port in it
            const config = JSON.parse(file.content);
            // Remove unknown keys that OpenClaw rejects
            delete config.meta;
            config.agents = config.agents || {};
            config.agents.defaults = config.agents.defaults || {};
            config.agents.defaults.workspace = workspaceDir;
            if (config.agents.list) {
                for (const agent of config.agents.list) {
                    agent.workspace = workspaceDir;
                }
            }
            config.gateway = config.gateway || {};
            config.gateway.mode = "local";
            config.gateway.bind = "lan";
            config.gateway.port = port;
            // Allow WebUI over HTTP (non-localhost) — fixes secure context disconnect
            config.gateway.controlUi = config.gateway.controlUi || {};
            config.gateway.controlUi.allowInsecureAuth = true;
            config.gateway.controlUi.dangerouslyDisableDeviceAuth = true;
            // Auth must use gateway.auth, not gateway.token (deprecated)
            delete config.gateway.token;
            delete config.gateway.auth;
            config.gateway.auth = { mode: "token", token: request.agentId };
            await sshWriteFile(ssh, configFile, JSON.stringify(config, null, 2));
        } else {
            // SOUL.md, USER.md, TOOLS.md go to workspace
            await sshWriteFile(ssh, `${workspaceDir}/${file.path}`, file.content);
        }
    }

    // 3. Write env vars to a .env file for the service
    const envLines = Object.entries(request.envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
    await sshWriteFile(ssh, `${stateDir}/.env`, envLines);

    // 4. Create systemd service unit
    const serviceUnit = `[Unit]
Description=ClawdGod Agent ${request.agentId}
After=network.target

[Service]
Type=simple
EnvironmentFile=${stateDir}/.env
Environment=OPENCLAW_STATE_DIR=${stateDir}
Environment=OPENCLAW_CONFIG_PATH=${configFile}
Environment=NODE_ENV=production
ExecStart=/usr/bin/openclaw gateway
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${service}

[Install]
WantedBy=multi-user.target
`;
    await sshWriteFile(ssh, `/etc/systemd/system/${service}.service`, serviceUnit);

    // 5. Start the gateway
    await sshExec(ssh, `systemctl daemon-reload`);
    await sshExec(ssh, `systemctl enable ${service}`);
    const startResult = await sshExec(ssh, `systemctl start ${service}`);

    if (startResult.exitCode !== 0) {
        await notifyBackend(request.agentId, "offline");
        throw new Error(`Agent start failed: ${startResult.stderr}`);
    }

    // Wait a moment for the gateway to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if the service is running
    const statusResult = await sshExec(ssh, `systemctl is-active ${service}`);
    const isRunning = statusResult.stdout.trim() === "active";

    if (!isRunning) {
        const logs = await sshExec(ssh, `journalctl -u ${service} --no-pager -n 20 2>&1`);
        await notifyBackend(request.agentId, "offline");
        throw new Error(`Agent not running after start. Logs:\n${logs.stdout}\n${logs.stderr}`);
    }

    // 6. Notify backend with gateway URL info
    await notifyBackend(request.agentId, "active", {
        containerId: `${ssh.host}:${port}`,
        gatewayPort: port,
        gatewayUrl: `http://${ssh.host}:${port}`,
    });

    return `${ssh.host}:${port}`;
}

/**
 * Stop an agent (but keep config).
 */
export async function stopAgent(
    ssh: SSHConfig,
    agentId: string
): Promise<void> {
    const service = serviceName(agentId);
    await sshExec(ssh, `systemctl stop ${service} 2>/dev/null || true`);
    await notifyBackend(agentId, "stopped");
}

/**
 * Restart an agent.
 */
export async function restartAgent(
    ssh: SSHConfig,
    agentId: string
): Promise<void> {
    const service = serviceName(agentId);
    await notifyBackend(agentId, "restarting");
    await sshExec(ssh, `systemctl restart ${service}`);

    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 3000));
    const statusResult = await sshExec(ssh, `systemctl is-active ${service}`);
    const isRunning = statusResult.stdout.trim() === "active";

    await notifyBackend(agentId, isRunning ? "active" : "offline");
}

/**
 * Delete an agent completely — stop service, remove config, remove state.
 */
export async function deleteAgent(
    ssh: SSHConfig,
    agentId: string
): Promise<void> {
    const service = serviceName(agentId);
    const profile = profileName(agentId);
    const stateDir = `/root/.openclaw-${profile}`;

    await sshExec(ssh, `systemctl stop ${service} 2>/dev/null || true`);
    await sshExec(ssh, `systemctl disable ${service} 2>/dev/null || true`);
    await sshExec(ssh, `rm -f /etc/systemd/system/${service}.service`);
    await sshExec(ssh, `systemctl daemon-reload`);
    await sshExec(ssh, `rm -rf ${stateDir}`);
}

/**
 * Check if an agent is running.
 */
export async function isAgentRunning(
    ssh: SSHConfig,
    agentId: string
): Promise<boolean> {
    const service = serviceName(agentId);
    const result = await sshExec(ssh, `systemctl is-active ${service} 2>/dev/null`);
    return result.stdout.trim() === "active";
}

/**
 * Get agent status info (systemd + openclaw health).
 */
export async function getAgentStats(
    ssh: SSHConfig,
    agentId: string
): Promise<{ status: string; uptime: string; memory: string; gatewayUrl: string } | null> {
    const service = serviceName(agentId);
    const port = agentPort(agentId);

    const statusResult = await sshExec(
        ssh,
        `systemctl show ${service} --property=ActiveState,MainPID,ExecMainStartTimestamp 2>/dev/null`
    );
    if (statusResult.exitCode !== 0) return null;

    const props = Object.fromEntries(
        statusResult.stdout.split("\n")
            .filter(line => line.includes("="))
            .map(line => line.split("=", 2) as [string, string])
    );

    // Get memory from pid if running
    let memory = "0MB";
    if (props.MainPID && props.MainPID !== "0") {
        const memResult = await sshExec(ssh, `ps -o rss= -p ${props.MainPID} 2>/dev/null`);
        if (memResult.exitCode === 0) {
            const rssKb = parseInt(memResult.stdout.trim());
            memory = `${Math.round(rssKb / 1024)}MB`;
        }
    }

    return {
        status: props.ActiveState || "unknown",
        uptime: props.ExecMainStartTimestamp || "unknown",
        memory,
        gatewayUrl: `http://${ssh.host}:${port}`,
    };
}

/**
 * Update personalization files (hot-reload — OpenClaw watches workspace).
 */
export async function updateAgentFiles(
    ssh: SSHConfig,
    agentId: string,
    files: { path: string; content: string }[]
): Promise<void> {
    const profile = profileName(agentId);
    const workspaceDir = `/root/.openclaw-${profile}/workspace`;
    for (const file of files) {
        await sshWriteFile(ssh, `${workspaceDir}/${file.path}`, file.content);
    }
}

/**
 * Get recent logs from agent's systemd journal.
 */
export async function getAgentLogs(
    ssh: SSHConfig,
    agentId: string,
    lines: number = 50
): Promise<string> {
    const service = serviceName(agentId);
    const result = await sshExec(ssh, `journalctl -u ${service} --no-pager -n ${lines} 2>&1`);
    return result.stdout;
}
