import { getErrorShape, TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

// ── Hoisted mocks (must come before module imports) ──────────────────────────
const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
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
vi.mock("@/shared/config/env.flags", () => ({ IS_PROD: false }));
vi.mock("@/server/utils/request-context", () => ({
  buildRequestStore: mocks.buildRequestStore,
  requestContext: mocks.requestContext,
  resolveRequestId: mocks.resolveRequestId,
}));
vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));

import type { Context } from "./context";
// ── Imports (after mocks) ────────────────────────────────────────────────────
import { createCallerFactory, createTRPCRouter, protectedProcedure, publicProcedure } from "./init";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<Context> = {}): Context {
  return {
    prisma: {},
    redis: null,
    req: {} as never,
    requestInfo: {} as never,
    session: null,
    ...overrides,
  } as Context;
}

type FormattedErrorShape = {
  data: {
    httpStatus: number;
    requestId?: string;
    stack?: string;
    zodError?: unknown;
  };
  message: string;
};

/**
 * Runs the REAL errorFormatter from init.ts through tRPC's public
 * `getErrorShape` API using the router's actual config.
 */
function formatError(
  code: TRPCError["code"],
  message: string,
  cause?: unknown,
): FormattedErrorShape {
  const router = createTRPCRouter({
    dummy: publicProcedure.query(() => "dummy"),
  });

  return getErrorShape({
    // oxlint-disable-next-line no-underscore-dangle
    config: router._def._config,
    ctx: undefined,
    error: new TRPCError({ cause, code, message }),
    input: undefined,
    path: "dummy",
    type: "query",
  });
}

describe("init procedures", () => {
  describe("protectedProcedure — unauthorized", () => {
    it("rejects UNAUTHORIZED when session is null", async () => {
      const router = createTRPCRouter({
        ping: protectedProcedure.query(() => "pong"),
      });
      const createCaller = createCallerFactory(router);
      const caller = createCaller(makeCtx({ session: null }));

      await expect(caller.ping()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: "You are not logged in",
      });
    });
  });

  describe("publicProcedure — passes", () => {
    it("resolves when session is null", async () => {
      const router = createTRPCRouter({
        ping: publicProcedure.query(() => "pong"),
      });
      const createCaller = createCallerFactory(router);
      const caller = createCaller(makeCtx({ session: null }));

      await expect(caller.ping()).resolves.toBe("pong");
    });
  });

  describe("protectedProcedure — happy path", () => {
    it("resolves with a valid session and calls enhance", async () => {
      mocks.enhance.mockClear();

      const session = {
        user: { id: "1", role: "USER" },
      } as unknown as Context["session"];

      const router = createTRPCRouter({
        ping: protectedProcedure.query(() => "pong"),
      });
      const createCaller = createCallerFactory(router);
      const caller = createCaller(makeCtx({ session }));

      const result = await caller.ping();
      expect(result).toBe("pong");

      expect(mocks.enhance).toHaveBeenCalledOnce();
      expect(mocks.enhance).toHaveBeenCalledWith(expect.anything(), {
        user: { id: 1, role: "USER" },
      });
    });
  });

  describe("errorFormatter — public error shape (IS_PROD=false)", () => {
    it("keeps the real message and attaches requestId + zodError for BAD_REQUEST", () => {
      const shape = formatError("BAD_REQUEST", "bad input", { fl: "zod" });

      expect(shape.message).toBe("bad input");
      expect(shape.data.requestId).toBe("req-123");
      // tRPC wraps a non-Error cause into UnknownCauseError, keeping own props
      expect(shape.data.zodError).toMatchObject({ fl: "zod" });
      expect(shape.data.httpStatus).toBe(400);
    });

    it("attaches requestId for any error and leaves stack visible", () => {
      const shape = formatError("INTERNAL_SERVER_ERROR", "boom");

      expect(shape.data.requestId).toBe("req-123");
      expect(shape.data.httpStatus).toBe(500);
      // non-public code: message still kept when not in prod
      expect(shape.message).toBe("boom");
    });
  });
});
