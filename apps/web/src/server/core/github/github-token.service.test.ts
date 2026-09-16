import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  createOAuthUserAuth: vi.fn(),
  getAccountForUpdate: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    account: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@octokit/auth-app", () => ({ createOAuthUserAuth: mocks.createOAuthUserAuth }));
vi.mock("@prisma/client/sql", () => ({ getAccountForUpdate: mocks.getAccountForUpdate }));
vi.mock("@/shared/config/env.server", () => ({
  AUTH_PROVIDERS: { github: { id: "client-id", secret: "client-secret" } },
}));
vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("../db", () => ({ prisma: mocks.prisma, redisClient: null }));

import { githubTokenService } from "./github-token.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
    cb({
      $queryRawTyped: vi.fn().mockResolvedValue(undefined),
      account: { findFirst: mocks.prisma.account.findFirst, update: vi.fn() },
    }),
  );
  mocks.prisma.account.findFirst.mockResolvedValue({
    accessToken: "token-abc",
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    id: 5,
    refreshToken: "refresh-abc",
  });
});

describe("githubTokenService.getValidToken", () => {
  it("returns null when no account exists", async () => {
    mocks.prisma.account.findFirst.mockResolvedValue(null);

    const result = await githubTokenService.getValidToken(1);

    expect(result).toBeNull();
  });

  it("returns null when account has no refreshToken", async () => {
    mocks.prisma.account.findFirst.mockResolvedValue({
      accessToken: "token-abc",
      accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      id: 5,
      refreshToken: null,
    });

    const result = await githubTokenService.getValidToken(1);

    expect(result).toBeNull();
  });

  it("returns token when not expired and does not call $transaction", async () => {
    const result = await githubTokenService.getValidToken(1);

    expect(result).toBe("token-abc");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refreshes expired token via createOAuthUserAuth", async () => {
    mocks.prisma.account.findFirst.mockResolvedValue({
      accessToken: "old-token",
      accessTokenExpiresAt: new Date(Date.now() - 3_600_000),
      id: 5,
      refreshToken: "refresh-old",
    });
    mocks.createOAuthUserAuth.mockReturnValue(
      vi.fn().mockResolvedValue({
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        refreshToken: "new-refresh",
        token: "new-token",
      }),
    );

    const txUpdate = vi.fn().mockResolvedValue({ accessToken: "new-token" });
    mocks.prisma.$transaction.mockImplementation((cb: (tx: any) => unknown) =>
      cb({
        $queryRawTyped: vi.fn().mockResolvedValue(undefined),
        account: { findFirst: mocks.prisma.account.findFirst, update: txUpdate },
      }),
    );

    const result = await githubTokenService.getValidToken(1);

    expect(result).toBe("new-token");
    expect(mocks.createOAuthUserAuth).toHaveBeenCalled();
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accessToken: "new-token" }),
      }),
    );
  });

  it("returns existing token when it becomes valid inside the transaction", async () => {
    let callCount = 0;
    mocks.prisma.account.findFirst.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // outer call: expired
        return Promise.resolve({
          accessToken: "token-abc",
          accessTokenExpiresAt: new Date(Date.now() - 3_600_000),
          id: 5,
          refreshToken: "refresh-abc",
        });
      }
      // inner call: refreshed by another worker
      return Promise.resolve({
        accessToken: "fresh-token",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        id: 5,
        refreshToken: "refresh-abc",
      });
    });

    const result = await githubTokenService.getValidToken(1);

    expect(result).toBe("fresh-token");
    expect(mocks.createOAuthUserAuth).not.toHaveBeenCalled();
  });

  it("returns null on fatal refresh error (status 401) and clears tokens", async () => {
    mocks.prisma.account.findFirst.mockResolvedValue({
      accessToken: "token-abc",
      accessTokenExpiresAt: new Date(Date.now() - 3_600_000),
      id: 5,
      refreshToken: "refresh-abc",
    });
    const fatalError = Object.assign(new Error("unauthorized"), { status: 401 });
    mocks.prisma.$transaction.mockRejectedValue(fatalError);

    const result = await githubTokenService.getValidToken(1);

    expect(result).toBeNull();
    expect(mocks.prisma.account.updateMany).toHaveBeenCalledWith({
      data: { accessToken: null, accessTokenExpiresAt: null, refreshToken: null },
      where: { providerId: "github", userId: 1 },
    });
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Cleared poisoned GitHub tokens to prevent infinite retry" }),
    );
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Token rotation failed" }),
    );
  });

  it("returns null on non-fatal refresh error (status 500) without clearing tokens", async () => {
    mocks.prisma.account.findFirst.mockResolvedValue({
      accessToken: "token-abc",
      accessTokenExpiresAt: new Date(Date.now() - 3_600_000),
      id: 5,
      refreshToken: "refresh-abc",
    });
    const error = Object.assign(new Error("boom"), { status: 500 });
    mocks.prisma.$transaction.mockRejectedValue(error);

    const result = await githubTokenService.getValidToken(1);

    expect(result).toBeNull();
    expect(mocks.prisma.account.updateMany).not.toHaveBeenCalled();
  });

  it("logs cleanup failure when updateMany rejects during fatal error handling", async () => {
    mocks.prisma.account.findFirst.mockResolvedValue({
      accessToken: "token-abc",
      accessTokenExpiresAt: new Date(Date.now() - 3_600_000),
      id: 5,
      refreshToken: "refresh-abc",
    });
    const fatalError = Object.assign(new Error("unauthorized"), { status: 401 });
    mocks.prisma.$transaction.mockRejectedValue(fatalError);
    mocks.prisma.account.updateMany.mockRejectedValue(new Error("db down"));

    const result = await githubTokenService.getValidToken(1);

    expect(result).toBeNull();
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Failed to clear poisoned tokens" }),
    );
  });
});
