import { beforeAll, describe, expect, it } from "vitest";

import {
  extractPayloadFromKey,
  generateApiKey,
  getApiKeyHash,
  getNormalizedHash,
  getRawHash,
  validateApiKeyChecksum,
} from "../../server/utils/hash";

describe("Cryptographic Hash & API Key Utilities", () => {
  beforeAll(() => {
    process.env.API_KEY_PEPPER = "test_api_key_pepper_secret_value_2026";
    process.env.API_KEY_CHECKSUM_SECRET = "test_checksum_hmac_secret_value_2026";
  });

  describe("generateApiKey & validateApiKeyChecksum", () => {
    it("should generate a valid API key with correct format and length", () => {
      const apiKey = generateApiKey();

      expect(apiKey.startsWith("dxnx_")).toBe(true);

      expect(apiKey.length).toBe(45);

      expect(validateApiKeyChecksum(apiKey)).toBe(true);
    });

    it("should reject keys with tampered payloads", () => {
      const originalKey = generateApiKey();

      const tamperedKey = originalKey.slice(0, 10) + "X" + originalKey.slice(11);

      expect(validateApiKeyChecksum(tamperedKey)).toBe(false);
    });

    it("should reject keys with tampered checksums", () => {
      const originalKey = generateApiKey();

      const tamperedKey = originalKey.slice(0, 44) + "0";

      expect(validateApiKeyChecksum(tamperedKey)).toBe(false);
    });

    it("should reject keys with incorrect prefixes", () => {
      const originalKey = generateApiKey();

      const tamperedKey = "ghp_" + originalKey.slice(5);

      expect(validateApiKeyChecksum(tamperedKey)).toBe(false);
    });

    it("should reject keys with incorrect lengths", () => {
      const originalKey = generateApiKey();

      expect(validateApiKeyChecksum(originalKey + "extra")).toBe(false);
      expect(validateApiKeyChecksum(originalKey.slice(0, 40))).toBe(false);
    });

    it("should reject keys with non-hex checksum characters", () => {
      const originalKey = generateApiKey();

      const tamperedKey1 = originalKey.slice(0, 44) + "g";
      const tamperedKey2 = originalKey.slice(0, 43) + "🚀";

      expect(validateApiKeyChecksum(tamperedKey1)).toBe(false);
      expect(validateApiKeyChecksum(tamperedKey2)).toBe(false);
    });

    it("should handle non-string and nullish inputs gracefully without crashing", () => {
      expect(validateApiKeyChecksum(null as any)).toBe(false);
      expect(validateApiKeyChecksum(undefined as any)).toBe(false);
      expect(validateApiKeyChecksum(123_456 as any)).toBe(false);
      expect(validateApiKeyChecksum({} as any)).toBe(false);
      expect(validateApiKeyChecksum([] as any)).toBe(false);
    });

    it("should reject payload containing emojis but matching correct length structure", () => {
      const fakePayload = "🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀";
      const fakeChecksum = "abcdef12";
      const fakeKey = `dxnx_${fakePayload}${fakeChecksum}`;

      expect(validateApiKeyChecksum(fakeKey)).toBe(false);
    });
  });

  describe("extractPayloadFromKey", () => {
    it("should successfully extract 32-character payload from a valid key", () => {
      const apiKey = generateApiKey();
      const payload = extractPayloadFromKey(apiKey);

      expect(payload).not.toBeNull();
      expect(payload?.length).toBe(32);

      expect(apiKey.includes(payload!)).toBe(true);
    });

    it("should return null when trying to extract payload from a tampered key", () => {
      const originalKey = generateApiKey();
      const tamperedKey = originalKey.slice(0, 20) + "X" + originalKey.slice(21);

      expect(extractPayloadFromKey(tamperedKey)).toBeNull();
    });
  });

  describe("getApiKeyHash", () => {
    it("should generate a stable 64-character SHA-256 HMAC hash", () => {
      const payload = "test_random_payload_value_123";
      const hash = getApiKeyHash(payload);

      expect(hash.length).toBe(64);

      expect(/^[\da-f]{64}$/.test(hash)).toBe(true);

      expect(getApiKeyHash(payload)).toBe(hash);
    });

    it("should generate different hashes for different payloads", () => {
      const hash1 = getApiKeyHash("payload_A");
      const hash2 = getApiKeyHash("payload_B");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("getRawHash & getNormalizedHash (Prisma/Field-Encryption compatibility)", () => {
    it("should compute raw SHA-256 hash for any string", () => {
      const val = "hello_world";
      const hash = getRawHash(val);

      expect(hash.length).toBe(64);
      expect(/^[\da-f]{64}$/.test(hash)).toBe(true);
      expect(hash).toBe(getRawHash(val));
    });

    it("should normalize, trim, lower-case, and NFC-normalize strings before hashing", () => {
      const rawInput1 = "   User@DOMAIN.com   ";
      const rawInput2 = "user@domain.com";

      const hash1 = getNormalizedHash(rawInput1);
      const hash2 = getNormalizedHash(rawInput2);

      const expectedHash = getRawHash("user@domain.com");

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(expectedHash);
      expect(hash1).toMatch(/^[\da-f]{64}$/);
    });

    it("should handle Unicode NFC normalization correctly", () => {
      const nfcString = "\u00E9";
      const nfdString = "e\u0301";

      expect(nfcString).not.toBe(nfdString);

      const hashNfc = getNormalizedHash(nfcString);
      const hashNfd = getNormalizedHash(nfdString);

      expect(hashNfc).toBe(hashNfd);
    });
  });
});
