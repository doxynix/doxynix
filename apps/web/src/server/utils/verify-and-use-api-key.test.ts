import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../core/app-logger", () => ({
  appLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../core/db", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("./hash", () => ({
  extractPayloadFromKey: vi.fn(),
  getApiKeyHash: vi.fn(),
  validateApiKeyChecksum: vi.fn(),
}));

import { appLogger } from "../core/app-logger";
import { prisma } from "../core/db";
import { extractPayloadFromKey, getApiKeyHash, validateApiKeyChecksum } from "./hash";
import { verifyAndUseApiKey } from "./verify-and-use-api-key";

describe("server/utils/verify-and-use-api-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return null if checksum validation fails", async () => {
    vi.mocked(validateApiKeyChecksum).mockReturnValue(false);

    const result = await verifyAndUseApiKey("invalid_checksum_token");

    expect(result).toBeNull();
    expect(extractPayloadFromKey).not.toHaveBeenCalled();
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("should return null if payload extraction fails", async () => {
    vi.mocked(validateApiKeyChecksum).mockReturnValue(true);
    vi.mocked(extractPayloadFromKey).mockReturnValue(null);

    const result = await verifyAndUseApiKey("corrupted_payload_token");

    expect(result).toBeNull();
    expect(getApiKeyHash).not.toHaveBeenCalled();
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("should return null if key hash is not found in database", async () => {
    vi.mocked(validateApiKeyChecksum).mockReturnValue(true);
    vi.mocked(extractPayloadFromKey).mockReturnValue("raw_payload_bytes");
    vi.mocked(getApiKeyHash).mockReturnValue("sha256_hashed_val");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

    const result = await verifyAndUseApiKey("dx_live_valid_format_unknown_key");

    expect(result).toBeNull();
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      include: { user: true },
      where: { hashedKey: "sha256_hashed_val" },
    });
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it("should return null if key record is revoked", async () => {
    const revokedKeyRecord = {
      hashedKey: "sha256_hashed_val",
      id: "key-revoked-123",
      revoked: true,
      user: { id: 1, name: "Alice" },
    };

    vi.mocked(validateApiKeyChecksum).mockReturnValue(true);
    vi.mocked(extractPayloadFromKey).mockReturnValue("raw_payload_bytes");
    vi.mocked(getApiKeyHash).mockReturnValue("sha256_hashed_val");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(revokedKeyRecord as never);

    const result = await verifyAndUseApiKey("dx_live_revoked_key");

    expect(result).toBeNull();
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it("should return keyRecord and update lastUsed timestamp for a valid active key", async () => {
    const validKeyRecord = {
      hashedKey: "sha256_hashed_val",
      id: "key-active-456",
      revoked: false,
      user: { id: 2, name: "Bob" },
    };

    vi.mocked(validateApiKeyChecksum).mockReturnValue(true);
    vi.mocked(extractPayloadFromKey).mockReturnValue("raw_payload_bytes");
    vi.mocked(getApiKeyHash).mockReturnValue("sha256_hashed_val");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(validKeyRecord as never);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as never);

    const result = await verifyAndUseApiKey("dx_live_active_key");

    expect(result).toEqual(validKeyRecord);
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      data: { lastUsed: expect.any(Date) },
      where: { id: "key-active-456" },
    });
  });

  it("should log error if background lastUsed update rejects with an Error", async () => {
    const validKeyRecord = {
      hashedKey: "sha256_hashed_val",
      id: "key-error-789",
      revoked: false,
      user: { id: 3, name: "Charlie" },
    };

    const dbError = new Error("Database write lock error");

    vi.mocked(validateApiKeyChecksum).mockReturnValue(true);
    vi.mocked(extractPayloadFromKey).mockReturnValue("raw_payload_bytes");
    vi.mocked(getApiKeyHash).mockReturnValue("sha256_hashed_val");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(validKeyRecord as never);
    vi.mocked(prisma.apiKey.update).mockRejectedValue(dbError);

    const result = await verifyAndUseApiKey("dx_live_key");

    expect(result).toEqual(validKeyRecord);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(appLogger.error).toHaveBeenCalledWith({
      error: { message: "Database write lock error", stack: expect.any(String) },
      keyId: "key-error-789",
      msg: "Failed to update api key lastUsed",
    });
  });

  it("should log error if background lastUsed update rejects with a non-Error object", async () => {
    const validKeyRecord = {
      hashedKey: "sha256_hashed_val",
      id: "key-error-999",
      revoked: false,
      user: { id: 4, name: "Dave" },
    };

    vi.mocked(validateApiKeyChecksum).mockReturnValue(true);
    vi.mocked(extractPayloadFromKey).mockReturnValue("raw_payload_bytes");
    vi.mocked(getApiKeyHash).mockReturnValue("sha256_hashed_val");
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(validKeyRecord as never);
    vi.mocked(prisma.apiKey.update).mockRejectedValue("String DB failure");

    const result = await verifyAndUseApiKey("dx_live_key");

    expect(result).toEqual(validKeyRecord);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(appLogger.error).toHaveBeenCalledWith({
      error: "String DB failure",
      keyId: "key-error-999",
      msg: "Failed to update api key lastUsed",
    });
  });
});
