import { getErrorShape, TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), info: vi.fn() },
  isProd: false,
}));

vi.mock("@zenstackhq/runtime", () => ({ enhance: (db: any) => db }));
vi.mock("@/shared/config/env.flags", () => ({
  get IS_PROD() {
    return mocks.isProd;
  },
}));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: () => ({ requestId: "req-123" }),
  requestContext: { getStore: () => ({ requestId: "req-123" }), run: (_s: any, fn: any) => fn() },
  resolveRequestId: () => "req-123",
}));
vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));

import { createCallerFactory, createTRPCRouter, protectedProcedure, publicProcedure } from "./init";

function formatError(code: TRPCError["code"], message: string) {
  const router = createTRPCRouter({ test: publicProcedure.query(() => "ok") });
  return getErrorShape({
    // oxlint-disable-next-line no-underscore-dangle
    config: router._def._config,
    ctx: undefined,
    error: new TRPCError({ code, message }),
    input: undefined,
    path: "test",
    type: "query",
  });
}

describe("tRPC Error Formatting & Security Boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isProd = false;
  });

  it("masks internal database errors and credentials in PROD mode to prevent data leaks", () => {
    mocks.isProd = true;
    const shape = formatError(
      "INTERNAL_SERVER_ERROR",
      "FATAL: password authentication failed for user postgres",
    );

    expect(shape.message).toBe("An unexpected error occurred, please try again later.");
    expect(shape.data.stack).toBeUndefined();
    expect(shape.data.requestId).toBe("req-123");
  });

  it("preserves public client-facing errors in PROD mode (BAD_REQUEST, NOT_FOUND)", () => {
    mocks.isProd = true;
    const shape = formatError("BAD_REQUEST", "Invalid UUID supplied");

    expect(shape.message).toBe("Invalid UUID supplied");
  });

  it("blocks unauthenticated callers on protectedProcedure with UNAUTHORIZED", async () => {
    const router = createTRPCRouter({ ping: protectedProcedure.query(() => "pong") });
    const caller = createCallerFactory(router)({
      prisma: {},
      req: {} as any,
      session: null,
    } as any);

    await expect(caller.ping()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "You are not logged in",
    });
  });
});
