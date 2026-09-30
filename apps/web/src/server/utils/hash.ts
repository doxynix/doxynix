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

function calculateChecksum(payload: string): string {
  return (
    crypto
      .createHmac("sha256", API_KEY_CHECKSUM_SECRET)
      // codeql[js/insufficient-password-hash] HMAC integrity checksum for API keys, not a password hash
      .update(payload)
      .digest("hex")
      .slice(0, CHECKSUM_LENGTH)
  );
}

// Format: dxnx_[32_char_payload][8_char_checksum], always exactly 45 characters.
export function generateApiKey(): string {
  const payload = crypto.randomBytes(24).toString("base64url");
  const checksum = calculateChecksum(payload);
  return `${BRAND_PREFIX}${payload}${checksum}`;
}

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

export function extractPayloadFromKey(apiKey: string): null | string {
  if (!validateApiKeyChecksum(apiKey)) {
    return null;
  }
  return apiKey.slice(BRAND_PREFIX.length, BRAND_PREFIX.length + PAYLOAD_LENGTH);
}

// PRISMA ONLY: must match the native hashing of the prisma-field-encryption library byte for byte.
export function getRawHash(value: string): string {
  const input = PRISMA_FIELD_ENCRYPTION_HASH_SALT
    ? value + PRISMA_FIELD_ENCRYPTION_HASH_SALT
    : value;
  return crypto.hash("sha256", input);
}

// HIGH-ENTROPY STRINGS ONLY: 192-bit payloads, peppered HMAC so a DB leak resists brute force.
export function getApiKeyHash(payload: string): string {
  // codeql[js/insufficient-password-hash] API key payload has 192 bits of entropy; HMAC-SHA256 with a pepper is not a password hash
  return crypto.createHmac("sha256", API_KEY_PEPPER).update(payload).digest("hex");
}

// PRISMA ONLY: hashes the NFC-normalized form, not the raw value.
export function getNormalizedHash(value: string): string {
  const normalized = value.trim().normalize("NFC").toLowerCase();
  return getRawHash(normalized);
}
