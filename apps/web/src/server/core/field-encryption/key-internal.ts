import crypto from "node:crypto";

export const KEY_PREFIX = "k1.aesgcm256.";
export const FINGERPRINT_LENGTH = 8;
const KEY_RE = /^k1\.aesgcm256\.(?<key>[A-Za-z0-9_-]{43}=?)$/;
const RAW_KEY_BYTES = 32;

export type ParsedKey = {
  fingerprint: string;
  raw: Buffer;
};

export function fingerprintOf(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex").slice(0, FINGERPRINT_LENGTH);
}

export function parseKey(key: string): ParsedKey {
  const match = KEY_RE.exec(key);

  if (match?.groups?.key == null) {
    throw new Error(
      `[field-encryption] Invalid encryption key format. Expected ${KEY_PREFIX}<base64url of 32 bytes>.`,
    );
  }

  const raw = Buffer.from(match.groups.key, "base64url");

  if (raw.length !== RAW_KEY_BYTES) {
    throw new Error(
      `[field-encryption] Encryption key must decode to ${RAW_KEY_BYTES} bytes, received ${raw.length}.`,
    );
  }

  // Fingerprint is derived from the serialized key text, not the raw bytes.
  return { fingerprint: fingerprintOf(key), raw };
}
