// ──────────────────────────────────────────────────────────────
// ClawdGod — SSH Connection Manager
// Manages SSH connections to Hetzner VPS nodes for Docker ops
// ──────────────────────────────────────────────────────────────

import { Client } from "ssh2";
import { readFileSync, existsSync } from "node:fs";

/**
 * Resolve SSH private key — if env var is a file path, read it;
 * otherwise treat it as raw key content.
 */
function resolvePrivateKey(): string | undefined {
    const val = process.env.HETZNER_SSH_PRIVATE_KEY;
    if (!val) return undefined;
    // If it looks like a file path, read it as UTF-8 string
    // (ssh2 needs OpenSSH-format keys as strings, not raw Buffers)
    if (val.startsWith("/") || val.startsWith("~")) {
        const expanded = val.replace(/^~/, process.env.HOME || "");
        if (existsSync(expanded)) {
            return readFileSync(expanded, "utf-8");
        }
    }
    return val;
}

export interface SSHConfig {
    host: string;
    port?: number;
    username?: string;
    privateKey?: string | Buffer;
}

/**
 * Execute a command on a remote VPS via SSH.
 * Returns { stdout, stderr, exitCode }.
 */
export function sshExec(
    config: SSHConfig,
    command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn
            .on("ready", () => {
                conn.exec(command, (err, stream) => {
                    if (err) {
                        conn.end();
                        return reject(err);
                    }

                    let stdout = "";
                    let stderr = "";

                    stream.on("data", (data: Buffer) => {
                        stdout += data.toString();
                    });

                    stream.stderr.on("data", (data: Buffer) => {
                        stderr += data.toString();
                    });

                    stream.on("close", (code: number) => {
                        conn.end();
                        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
                    });
                });
            })
            .on("error", reject)
            .connect({
                host: config.host,
                port: config.port ?? 22,
                username: config.username ?? "root",
                privateKey: config.privateKey ?? resolvePrivateKey(),
            });
    });
}

/**
 * Transfer a file to the remote VPS via SFTP.
 */
export function sshWriteFile(
    config: SSHConfig,
    remotePath: string,
    content: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        const conn = new Client();

        conn
            .on("ready", () => {
                conn.sftp((err, sftp) => {
                    if (err) {
                        conn.end();
                        return reject(err);
                    }

                    const stream = sftp.createWriteStream(remotePath);
                    stream.on("close", () => {
                        conn.end();
                        resolve();
                    });
                    stream.on("error", (e: Error) => {
                        conn.end();
                        reject(e);
                    });
                    stream.end(content);
                });
            })
            .on("error", reject)
            .connect({
                host: config.host,
                port: config.port ?? 22,
                username: config.username ?? "root",
                privateKey: config.privateKey ?? resolvePrivateKey(),
            });
    });
}
