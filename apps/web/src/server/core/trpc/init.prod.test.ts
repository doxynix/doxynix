import { getErrorShape, TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    info: vi.fn(),
    warn: vi.fn(),
  },
  buildRequestStore: vi.fn((o: unknown) => ({
    requestId: "req-123",
    ...(o as object),
  })),
  enhance: vi.fn((db: unknown) => db),
  requestContext: {
    getStore: vi.fn(() => ({ requestId: "req-123" })),
    run: vi.fn((_s: unknown, fn: () => unknown) => fn()),
  },
  resolveRequestId: vi.fn(() => "req-123"),
}));

vi.mock("@zenstackhq/runtime", () => ({ enhance: mocks.enhance }));
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: true }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: mocks.buildRequestStore,
  requestContext: mocks.requestContext,
  resolveRequestId: mocks.resolveRequestId,
}));
vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));

// ── Imports (after mocks) ────────────────────────────────────────────────────
import { createTRPCRouter, publicProcedure } from "./init";

describe("init errorFormatter — IS_PROD=true", () => {
  it("hides internal error messages and stack when IS_PROD", () => {
    const router = createTRPCRouter({
      dummy: publicProcedure.query(() => "dummy"),
    });

    const shape = getErrorShape({
      // oxlint-disable-next-line no-underscore-dangle
      config: router._def._config,
      ctx: undefined,
      error: new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "secret internals",
      }),
      input: undefined,
      path: "dummy",
      type: "query",
    });

    expect(shape.message).toBe("An unexpected error occurred, please try again later.");
    expect(shape.data.stack).toBeUndefined();
    expect(shape.data.requestId).toBe("req-123");
  });

  it("keeps public error messages even in prod (BAD_REQUEST is public)", () => {
    const router = createTRPCRouter({
      dummy: publicProcedure.query(() => "dummy"),
    });

    const shape = getErrorShape({
      // oxlint-disable-next-line no-underscore-dangle
      config: router._def._config,
      ctx: undefined,
      error: new TRPCError({ code: "BAD_REQUEST", message: "bad input" }),
      input: undefined,
      path: "dummy",
      type: "query",
    });

    expect(shape.message).toBe("bad input");
    expect(shape.data.stack).toBeUndefined();
  });
});
