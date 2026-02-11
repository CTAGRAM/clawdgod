// ──────────────────────────────────────────────────────────────
// ClawdGod — AES-256-GCM Encryption Utility
// All API keys and sensitive config are encrypted before DB storage.
// IV is unique per secret. Auth tag ensures tamper detection.
// ──────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
    const key = process.env.MASTER_ENCRYPTION_KEY;
    if (!key) {
        throw new Error("MASTER_ENCRYPTION_KEY environment variable is required");
    }
    // Key should be 32 bytes (64 hex chars)
    return Buffer.from(key, "hex");
}

export interface EncryptedData {
    ciphertext: string; // base64
    iv: string; // base64
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns ciphertext (with appended auth tag) and IV, both base64-encoded.
 */
export function encrypt(plaintext: string): EncryptedData {
    const key = getMasterKey();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Append auth tag to ciphertext
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([
        Buffer.from(encrypted, "base64"),
        authTag,
    ]);

    return {
        ciphertext: combined.toString("base64"),
        iv: iv.toString("base64"),
    };
}

/**
 * Decrypt AES-256-GCM encrypted data.
 * Verifies auth tag to detect tampering.
 */
export function decrypt(data: EncryptedData): string {
    const key = getMasterKey();
    const iv = Buffer.from(data.iv, "base64");
    const combined = Buffer.from(data.ciphertext, "base64");

    // Separate ciphertext and auth tag
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

/**
 * Generate a random 32-byte hex string suitable for MASTER_ENCRYPTION_KEY.
 */
export function generateMasterKey(): string {
    return randomBytes(32).toString("hex");
}
