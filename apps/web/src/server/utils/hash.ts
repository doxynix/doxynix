import crypto from "node:crypto";

import {
  API_KEY_CHECKSUM_SECRET,
  API_KEY_PEPPER,
  PRISMA_FIELD_ENCRYPTION_HASH_SALT,
} from "@/shared/config/env.server";

const BRAND_PREFIX = "dxnx_";
const CHECKSUM_LENGTH = 8;
const PAYLOAD_LENGTH = 32;
const TOTAL_KEY_LENGTH = BRAND_PREFIX.length + PAYLOAD_LENGTH + CHECKSUM_LENGTH;
const HEX_REGEX = /^[\da-f]{8}$/;

/**
 * Generates a cryptographic checksum (first 8 characters of HMAC-SHA256) for the key payload.
 */
// codeql[js/insufficient-password-hash]
function calculateChecksum(payload: string): string {
  return crypto
    .createHmac("sha256", API_KEY_CHECKSUM_SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, CHECKSUM_LENGTH);
}

/**
 * Generates a new secure API key with an embedded checksum in continuous format (Continuous PAT).
 * Format: dxnx_[32_char_payload][8_char_checksum] (Total: exactly 45 characters)
 * Example: dxnx_Y29uc29saWRhdGVkX2V4Y2VwdGlvbg2b6c7d8
 */
export function generateApiKey(): string {
  const payload = crypto.randomBytes(24).toString("base64url");
  const checksum = calculateChecksum(payload);
  return `${BRAND_PREFIX}${payload}${checksum}`;
}

/**
 * Validates the API key checksum locally on CPU without database lookups.
 */
export function validateApiKeyChecksum(apiKey: string): boolean {
  if (
    typeof apiKey !== "string" ||
    apiKey.length !== TOTAL_KEY_LENGTH ||
    !apiKey.startsWith(BRAND_PREFIX)
  ) {
    return false;
  }

  const cleanKey = apiKey.slice(BRAND_PREFIX.length);

  const payload = cleanKey.slice(0, PAYLOAD_LENGTH);
  const checksum = cleanKey.slice(PAYLOAD_LENGTH);

  if (!HEX_REGEX.test(checksum)) {
    return false;
  }

  const expectedChecksum = calculateChecksum(payload);

  const bufChecksum = Buffer.from(checksum);
  const bufExpected = Buffer.from(expectedChecksum);

  return crypto.timingSafeEqual(bufChecksum, bufExpected);
}

/**
 * Helper method to safely extract the payload from the key (for hashing in the database).
 */
export function extractPayloadFromKey(apiKey: string): null | string {
  if (!validateApiKeyChecksum(apiKey)) {
    return null;
  }
  return apiKey.slice(BRAND_PREFIX.length, BRAND_PREFIX.length + PAYLOAD_LENGTH);
}

/**
 * Generates a standard SHA-256 hash for the given value.
 * USED STRICTLY FOR PRISMA: to ensure 100% compatibility with native
 * hash generation in the "prisma-field-encryption" library.
 */
export function getRawHash(value: string): string {
  const input = PRISMA_FIELD_ENCRYPTION_HASH_SALT
    ? value + PRISMA_FIELD_ENCRYPTION_HASH_SALT
    : value;
  return crypto.hash("sha256", input);
}

/**
 * Generates a fast HMAC-SHA256 hash signature for storing API keys in the database.
 * The method is completely safe, as the original payload has high entropy (192 bits).
 * Using HMAC guarantees protection against brute force in case of a database leak (thanks to the secret API_KEY_PEPPER).
 * USE STRICTLY FOR HIGH-ENTROPY STRINGS!
 */
// codeql[js/insufficient-password-hash]
export function getApiKeyHash(payload: string): string {
  return crypto.createHmac("sha256", API_KEY_PEPPER).update(payload).digest("hex");
}

/**
 * Generates a SHA-256 hash for a normalized value with Unicode NFC normalization support.
 * USED STRICTLY FOR PRISMA.
 */
export function getNormalizedHash(value: string): string {
  const normalized = value.trim().normalize("NFC").toLowerCase();
  return getRawHash(normalized);
}
