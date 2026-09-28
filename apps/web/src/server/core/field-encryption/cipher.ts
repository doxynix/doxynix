import crypto from "node:crypto";

export const ENVELOPE_VERSION = "v1";
export const ENVELOPE_ALGORITHM = "aesgcm256";

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const RAW_KEY_BYTES = 32;
const BASE64_URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;

export type ParsedEnvelope = {
  ciphertext: string;
  fingerprint: string;
  iv: string;
};

export function encodeEncryptedString(fingerprint: string, iv: Buffer, ciphertext: Buffer): string {
  return [
    ENVELOPE_VERSION,
    ENVELOPE_ALGORITHM,
    fingerprint,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function parseEncryptedString(input: string): ParsedEnvelope | false {
  if (typeof input !== "string") {
    return false;
  }

  const parts = input.split(".");

  if (parts.length !== 5) {
    return false;
  }

  const [version, algorithm, fingerprint, iv, ciphertext] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  if (version !== ENVELOPE_VERSION || algorithm !== ENVELOPE_ALGORITHM) {
    return false;
  }

  if (!/^[\da-f]{8}$/i.test(fingerprint)) {
    return false;
  }

  if (!BASE64_URL_RE.test(iv) || iv.length !== 16) {
    return false;
  }

  if (!BASE64_URL_RE.test(ciphertext) || ciphertext.length < 24) {
    return false;
  }

  return { ciphertext, fingerprint, iv };
}

export function looksEncrypted(input: unknown): input is string {
  return typeof input === "string" && parseEncryptedString(input) !== false;
}

export function encryptString(plaintext: string, rawKey: Buffer, fingerprint: string): string {
  assertKeyLength(rawKey);

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", rawKey, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return encodeEncryptedString(fingerprint, iv, Buffer.concat([body, cipher.getAuthTag()]));
}

export function decryptString(envelope: string, rawKey: Buffer): string {
  assertKeyLength(rawKey);

  const parsed = parseEncryptedString(envelope);

  if (parsed === false) {
    throw new Error(`[field-encryption] Unknown message format: ${envelope.slice(0, 40)}`);
  }

  const bytes = Buffer.from(parsed.ciphertext, "base64url");
  const tagStart = bytes.length - AUTH_TAG_BYTES;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    rawKey,
    Buffer.from(parsed.iv, "base64url"),
  );
  decipher.setAuthTag(bytes.subarray(tagStart));

  // Concatenating buffers rather than decoding each chunk to a string: a UTF-8
  // code point straddling the two chunks would otherwise be mangled.
  return Buffer.concat([decipher.update(bytes.subarray(0, tagStart)), decipher.final()]).toString(
    "utf8",
  );
}

function assertKeyLength(rawKey: Buffer): void {
  if (rawKey.length !== RAW_KEY_BYTES) {
    throw new Error(
      `[field-encryption] Key must be ${RAW_KEY_BYTES} bytes, received ${rawKey.length}`,
    );
  }
}
