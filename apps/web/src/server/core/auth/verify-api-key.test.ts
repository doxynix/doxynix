import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma, runAsBackgroundTask } from "@/server/core/db";
import { extractPayloadFromKey, generateApiKey, getApiKeyHash } from "@/server/utils/hash";

import { verifyAndUseApiKey } from "./verify-api-key";

vi.mock("@/server/core/db", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  // Runs the scheduled task inline so the assertions below observe its effect.
  runAsBackgroundTask: vi.fn(async (task: () => Promise<void>) => {
    await task();
  }),
}));

const KEY_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

const TOKEN = generateApiKey();
const HASHED_KEY = getApiKeyHash(extractPayloadFromKey(TOKEN) as string);

const dbMock = prisma as unknown as {
  apiKey: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};
const backgroundMock = runAsBackgroundTask as unknown as ReturnType<typeof vi.fn>;

function makeKeyRecord(overrides?: Record<string, unknown>) {
  return {
    expiresAt: null,
    id: KEY_ID,
    lastUsed: null,
    revoked: false,
    revokedAfter: null,
    ...overrides,
  };
}

describe("verifyAndUseApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.apiKey.updateMany.mockResolvedValue({ count: 1 });
    dbMock.apiKey.update.mockResolvedValue({});
  });

  it("should look the key up by its hash, never by the token itself", async () => {
    dbMock.apiKey.findUnique.mockResolvedValue(makeKeyRecord({ lastUsed: new Date() }));

    await verifyAndUseApiKey(TOKEN);

    expect(dbMock.apiKey.findUnique).toHaveBeenCalledWith({
      include: { user: true },
      where: { hashedKey: HASHED_KEY },
    });
  });

  it("should stamp lastUsed when the key has never been used", async () => {
    dbMock.apiKey.findUnique.mockResolvedValue(makeKeyRecord({ lastUsed: null }));

    await verifyAndUseApiKey(TOKEN);

    expect(backgroundMock).toHaveBeenCalledOnce();
    expect(dbMock.apiKey.updateMany).toHaveBeenCalledWith({
      data: { lastUsed: expect.any(Date) },
      where: { id: KEY_ID },
    });
  });

  it("should skip the write while lastUsed is still fresh", async () => {
    dbMock.apiKey.findUnique.mockResolvedValue(
      makeKeyRecord({ lastUsed: new Date(Date.now() - 10 * 60 * 1000) }),
    );

    await verifyAndUseApiKey(TOKEN);

    expect(backgroundMock).not.toHaveBeenCalled();
    expect(dbMock.apiKey.updateMany).not.toHaveBeenCalled();
  });

  it("should stamp lastUsed again once the debounce window has passed", async () => {
    dbMock.apiKey.findUnique.mockResolvedValue(
      makeKeyRecord({ lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
    );

    await verifyAndUseApiKey(TOKEN);

    expect(backgroundMock).toHaveBeenCalledOnce();
    expect(dbMock.apiKey.updateMany).toHaveBeenCalledOnce();
  });

  it("should reject a key whose grace window has closed", async () => {
    dbMock.apiKey.findUnique.mockResolvedValue(
      makeKeyRecord({ revoked: true, revokedAfter: new Date(Date.now() - 1000) }),
    );

    await expect(verifyAndUseApiKey(TOKEN)).resolves.toBeNull();
    expect(dbMock.apiKey.update).toHaveBeenCalledWith({
      data: { revoked: true },
      where: { id: KEY_ID },
    });
  });

  it("should reject an expired key without stamping lastUsed", async () => {
    dbMock.apiKey.findUnique.mockResolvedValue(
      makeKeyRecord({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(verifyAndUseApiKey(TOKEN)).resolves.toBeNull();
    expect(dbMock.apiKey.updateMany).not.toHaveBeenCalled();
    expect(dbMock.apiKey.update).toHaveBeenCalledWith({
      data: { revoked: true },
      where: { id: KEY_ID },
    });
  });

  it("should ignore a token whose checksum does not validate", async () => {
    await expect(verifyAndUseApiKey("dxnx_not-a-real-token")).resolves.toBeNull();
    expect(dbMock.apiKey.findUnique).not.toHaveBeenCalled();
  });
});
