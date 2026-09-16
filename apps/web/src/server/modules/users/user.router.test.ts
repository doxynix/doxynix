import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
  del: vi.fn(),
  enhance: vi.fn((db: unknown) => db),
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@vercel/blob", () => ({ del: mocks.del }));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma, redisClient: null }));
vi.mock("@zenstackhq/runtime", () => ({ enhance: mocks.enhance }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: vi.fn((o: unknown) => ({ ...(o as object), requestId: "req-1" })),
  requestContext: {
    getStore: vi.fn(() => null),
    run: vi.fn((_s: unknown, fn: () => unknown) => fn()),
  },
  resolveRequestId: vi.fn(() => "req-1"),
}));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));
vi.mock("@/server/utils/ua-parser", () => ({
  formatUserAgent: vi.fn((ua: string | null) => ua ?? "Unknown"),
}));

import { createCallerFactory } from "@/server/core/trpc/init";

import { userRouter } from "./user.router";

const createCaller = createCallerFactory(userRouter);

const UUID = "6d5c4b3a-2c1d-4e5f-8a9b-0f1e2d3c4b5a";

// enhance() is mocked as identity → after withZenStack, ctx.db === ctx.prisma.
// Global `mocks.prisma` (module-level import) is used by deleteAccount/removeAvatar.
function makeCtx(overrides: Record<string, unknown> = {}) {
  const prisma = {
    $transaction: vi.fn(),
    account: { count: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    session: { findMany: vi.fn() },
    user: { delete: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    db: prisma,
    prisma,
    redis: null,
    req: {},
    requestInfo: {},
    session: { user: { id: "42", role: "USER" } },
    ...overrides,
  };
}

function makeCaller(overrides?: Record<string, unknown>) {
  const ctx = makeCtx(overrides);
  return { caller: createCaller(ctx as never), ctx };
}
function fullUser(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date("2026-01-01T00:00:00Z"),
    email: "alice@example.com",
    emailVerified: true,
    image: "https://example.com/alice.png",
    name: "Alice",
    publicId: UUID,
    role: "USER",
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.findUnique.mockResolvedValue(null);
  mocks.del.mockResolvedValue(undefined);
});

describe("userRouter authorization", () => {
  it("rejects UNAUTHORIZED for protected procedures without a session", async () => {
    const { caller } = makeCaller({ session: null });

    await expect(caller.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "You are not logged in",
    });
  });
});

describe("deleteAccount", () => {
  it("deletes the user via global prisma and skips blob deletion without imageKey", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: null });
    const { caller, ctx } = makeCaller();
    ctx.prisma.user.delete.mockResolvedValue({ id: 42 });

    const result = await caller.deleteAccount();

    // Asserted against global prisma (module-level @/server/core/db).
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
      select: { imageKey: true },
      where: { id: 42 },
    });
    expect(ctx.prisma.user.delete).toHaveBeenCalledWith({ where: { id: 42 } });
    expect(mocks.del).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toEqual(expect.stringContaining("permanently deleted"));
  });
  it("deletes the avatar blob when imageKey exists", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: "key-1" });
    const { caller, ctx } = makeCaller();
    ctx.prisma.user.delete.mockResolvedValue({ id: 42 });
    await expect(caller.deleteAccount()).resolves.toMatchObject({ success: true });
    expect(mocks.del).toHaveBeenCalledWith("key-1");
  });
  it("rejects NOT_FOUND when the user does not exist", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const { caller, ctx } = makeCaller();
    await expect(caller.deleteAccount()).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
    });
    expect(ctx.prisma.user.delete).not.toHaveBeenCalled();
  });
  it("still succeeds and logs when blob deletion throws", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: "key-1" });
    mocks.del.mockRejectedValue(new Error("blob boom"));
    const { caller, ctx } = makeCaller();
    ctx.prisma.user.delete.mockResolvedValue({ id: 42 });

    await expect(caller.deleteAccount()).resolves.toMatchObject({ success: true });
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        imageKey: "key-1",
        msg: "Failed to delete avatar on account deletion",
        userId: 42,
      }),
    );
  });
});

describe("removeAvatar", () => {
  it("clears image fields and skips blob deletion without imageKey", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: null });
    const { caller, ctx } = makeCaller();
    ctx.prisma.user.update.mockResolvedValue(fullUser());
    const result = await caller.removeAvatar();
    expect(ctx.prisma.user.update).toHaveBeenCalledWith({
      data: { image: null, imageKey: null },
      where: { id: 42 },
    });
    expect(mocks.del).not.toHaveBeenCalled();
    expect(result).toMatchObject({ message: "Profile Picture removed", success: true });
  });
  it("deletes the blob and logs when blob deletion throws", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: "key-2" });
    mocks.del.mockRejectedValue(new Error("blob boom"));
    const { caller, ctx } = makeCaller();
    ctx.prisma.user.update.mockResolvedValue(fullUser());
    await expect(caller.removeAvatar()).resolves.toMatchObject({ success: true });
    expect(mocks.del).toHaveBeenCalledWith("key-2");
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        keyToDelete: "key-2",
        msg: "Failed to delete avatar from Vercel Blob during removal",
        userId: 42,
      }),
    );
  });
});

describe("disconnectAccount", () => {
  it("deletes the account when another auth method exists", async () => {
    const { caller, ctx } = makeCaller();
    const tx = {
      account: {
        count: vi.fn().mockResolvedValue(2),
        delete: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "acct-1" }),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ email: "a@b.c", emailVerified: true }) },
    };
    ctx.prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));

    await expect(caller.disconnectAccount({ provider: "github" })).resolves.toEqual({
      success: true,
    });
    expect(tx.account.delete).toHaveBeenCalledWith({
      where: { userId_providerId: { providerId: "github", userId: 42 } },
    });
  });

  it("rejects NOT_FOUND when the account is missing", async () => {
    const { caller, ctx } = makeCaller();
    const tx = {
      account: { count: vi.fn(), delete: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
      user: { findUnique: vi.fn() },
    };
    ctx.prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));

    await expect(caller.disconnectAccount({ provider: "google" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Account not found or already disconnected.",
    });
  });

  it("rejects BAD_REQUEST when disconnecting the only auth method", async () => {
    const { caller, ctx } = makeCaller();
    const tx = {
      account: {
        count: vi.fn().mockResolvedValue(1),
        delete: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "acct-1" }),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ email: null, emailVerified: false }) },
    };
    ctx.prisma.$transaction.mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx));
    await expect(caller.disconnectAccount({ provider: "yandex" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("only authentication method"),
    });
  });
});

describe("getActiveSessions", () => {
  it("maps sessions and formats user agents", async () => {
    const { caller, ctx } = makeCaller();
    ctx.prisma.session.findMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-01T00:00:00Z"),
        id: "s1",
        ipAddress: "127.0.0.1",
        token: "tok-1",
        userAgent: "Mozilla/5.0",
      },
      {
        createdAt: new Date("2026-01-02T00:00:00Z"),
        id: "s2",
        ipAddress: "127.0.0.2",
        token: "tok-2",
        userAgent: null,
      },
    ]);
    const result = await caller.getActiveSessions();
    expect(ctx.prisma.session.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      where: { userId: 42 },
    });
    expect(result).toEqual([
      expect.objectContaining({ id: "s1", userAgent: "Mozilla/5.0" }),
      expect.objectContaining({ id: "s2", userAgent: "Unknown" }),
    ]);
  });
});

describe("getLinkedAccounts", () => {
  it("returns accounts mapped by provider and the user", async () => {
    const { caller, ctx } = makeCaller();
    ctx.prisma.account.findMany.mockResolvedValue([
      {
        accountId: "acct-1",
        email: "alice@example.com",
        image: null,
        name: "Alice",
        providerId: "github",
      },
    ]);
    ctx.prisma.user.findUnique.mockResolvedValue({
      email: "alice@example.com",
      emailVerified: true,
    });
    const result = await caller.getLinkedAccounts();
    expect(ctx.prisma.account.findMany).toHaveBeenCalledWith({
      orderBy: { providerId: "asc" },
      select: { accountId: true, email: true, image: true, name: true, providerId: true },
      where: { userId: 42 },
    });
    expect(result).toEqual({
      accounts: [
        {
          accountId: "acct-1",
          email: "alice@example.com",
          image: null,
          name: "Alice",
          provider: "github",
        },
      ],
      user: { email: "alice@example.com", emailVerified: true },
    });
  });
});

describe("me", () => {
  it("returns the public user mapped from publicId", async () => {
    const { caller, ctx } = makeCaller();
    ctx.prisma.user.findUnique.mockResolvedValue(fullUser());
    const result = await caller.me();
    expect(ctx.prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 42 } });
    expect(result).toMatchObject({
      message: "User found",
      user: { email: "alice@example.com", id: UUID, name: "Alice", role: "USER" },
    });
  });
  it("rejects NOT_FOUND when the user does not exist", async () => {
    const { caller, ctx } = makeCaller();
    ctx.prisma.user.findUnique.mockResolvedValue(null);
    await expect(caller.me()).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
    });
  });
});

describe("updateUser", () => {
  it("updates the name and returns the mapped user", async () => {
    const { caller, ctx } = makeCaller();
    ctx.prisma.user.update.mockResolvedValue(fullUser({ name: "New" }));
    const result = await caller.updateUser({ name: "New" });
    expect(ctx.prisma.user.update).toHaveBeenCalledWith({
      data: { name: "New" },
      where: { id: 42 },
    });
    expect(result).toMatchObject({
      message: "Credentials updated",
      user: { id: UUID, name: "New", role: "USER" },
    });
  });
  it("rejects BAD_REQUEST for invalid input (empty name fails minLength)", async () => {
    const { caller } = makeCaller();
    await expect(caller.updateUser({ name: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
