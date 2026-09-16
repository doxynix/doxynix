import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks for middleware dependencies
const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  enhance: vi.fn((db: unknown) => db),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@zenstackhq/runtime", () => ({ enhance: mocks.enhance }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: vi.fn((o: unknown) => ({ ...(o as object), requestId: "req-1" })),
  requestContext: {
    getStore: vi.fn(() => null),
    run: vi.fn((_store: unknown, fn: () => unknown) => fn()),
  },
  resolveRequestId: vi.fn(() => "req-1"),
}));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));

import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/core/trpc/init";

import { healthRouter } from "./health.router";

const makeCtx = (overrides = {}) => ({
  db: {},
  prisma: { $queryRaw: vi.fn() },
  redis: null,
  req: {},
  requestInfo: {},
  session: null,
  ...overrides,
});

const createCaller = createCallerFactory(healthRouter);

describe("healthRouter.check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when $queryRaw resolves", async () => {
    const ctx = makeCtx();
    ctx.prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const caller = createCaller(ctx as never);
    await expect(caller.check()).resolves.toEqual({ status: "ok" });
  });

  it("wraps generic Error into INTERNAL_SERVER_ERROR", async () => {
    const ctx = makeCtx();
    ctx.prisma.$queryRaw.mockRejectedValue(new Error("connection lost"));

    const caller = createCaller(ctx as never);
    await expect(caller.check()).rejects.toThrow("Internal database error");

    expect(mocks.appLogger.error).toHaveBeenCalledWith({
      error: expect.any(Error),
      msg: "Unknown Prisma Error:",
    });
  });

  it("maps Prisma P2025 to NOT_FOUND", async () => {
    const ctx = makeCtx();
    ctx.prisma.$queryRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        clientVersion: "5.0.0",
        code: "P2025",
      }),
    );

    const caller = createCaller(ctx as never);
    await expect(caller.check()).rejects.toThrow("Record not found");
  });

  it("re-throws TRPCError as-is", async () => {
    const ctx = makeCtx();
    ctx.prisma.$queryRaw.mockRejectedValue(new TRPCError({ code: "BAD_REQUEST", message: "boom" }));

    const caller = createCaller(ctx as never);
    await expect(caller.check()).rejects.toThrow("boom");
  });

  it("accepts empty object as skipped input", async () => {
    const ctx = makeCtx();
    ctx.prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const caller = createCaller(ctx as never);
    await expect(caller.check({})).resolves.toEqual({ status: "ok" });
  });
});
