// ──────────────────────────────────────────────────────────────
// ClawdGod — Local Shell Execution (replaces SSH for same-host)
// Runs commands directly via child_process when orchestrator
// is on the same machine as the agent host.
// ──────────────────────────────────────────────────────────────

import { exec } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// Keep the SSHConfig interface for API compatibility
// but the host field is ignored for local execution.
export interface SSHConfig {
    host: string;
    port?: number;
    username?: string;
    privateKey?: string | Buffer;
}

/**
 * Execute a command on the local machine.
 * API-compatible with the SSH version — SSHConfig is accepted but ignored.
 */
export function sshExec(
    _config: SSHConfig,
    command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
        exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            resolve({
                stdout: (stdout || "").trim(),
                stderr: (stderr || "").trim(),
                exitCode: error ? (error.code ?? 1) : 0,
            });
        });
    });
}

/**
 * Write a file to the local filesystem.
 * API-compatible with the SSH version.
 */
export async function sshWriteFile(
    _config: SSHConfig,
    filePath: string,
    content: string
): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
}
