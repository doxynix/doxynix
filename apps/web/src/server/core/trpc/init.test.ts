import { getErrorShape, TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type KnownErrorOptions = {
  clientVersion: string;
  code: string;
  meta?: { target?: string | string[] };
};

// `api-error.ts` narrows with `instanceof Prisma.PrismaClientKnownRequestError`, so these tests must throw an instance of the very class that module sees.
const MockPrismaClientKnownRequestError = vi.hoisted(
  () =>
    class PrismaClientKnownRequestError extends Error {
      public code: string;
      public meta: KnownErrorOptions["meta"];

      public constructor(message: string, options: KnownErrorOptions) {
        super(message);
        this.code = options.code;
        this.meta = options.meta;
      }
    },
);

vi.mock("@prisma/client/runtime/library", () => ({
  PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
}));

vi.mock("@prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

const prismaError = (code: string) =>
  new MockPrismaClientKnownRequestError("db failed", { clientVersion: "test", code });

const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
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
  withProcedureContext: (_parent: any, _overrides: any, fn: any) => fn(),
}));
vi.mock("../app-logger", () => ({ appLogger: mocks.appLogger }));

import { createCallerFactory, createTRPCRouter, protectedProcedure, publicProcedure } from "./init";

function buildConfig() {
  const router = createTRPCRouter({ test: publicProcedure.query(() => "ok") });
  return router._def["_config"];
}

function formatError(code: TRPCError["code"], message: string) {
  return getErrorShape({
    config: buildConfig(),
    ctx: undefined,
    error: new TRPCError({ code, message }),
    input: undefined,
    path: "test",
    type: "query",
  });
}

// Mirrors tRPC: `getTRPCErrorFromUnknown` builds an INTERNAL_SERVER_ERROR `TRPCError` whose `cause` is the original.
function formatCause(cause: unknown) {
  return getErrorShape({
    config: buildConfig(),
    ctx: undefined,
    error: new TRPCError({ cause, code: "INTERNAL_SERVER_ERROR" }),
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

  it("preserves the actionable copy of PRECONDITION_FAILED, which the old list omitted", () => {
    mocks.isProd = true;
    const shape = formatError("PRECONDITION_FAILED", "GitHub App is not installed for this repo.");

    expect(shape.message).toBe("GitHub App is not installed for this repo.");
    expect(shape.data.code).toBe("PRECONDITION_FAILED");
  });

  it("re-maps a raw Prisma cause that a service never wrapped in handlePrismaError", () => {
    // The formatter must recover NOT_FOUND from `cause`, otherwise every unprotected Prisma call site answers 500.
    const shape = formatCause(prismaError("P2025"));

    expect(shape.data.code).toBe("NOT_FOUND");
    expect(shape.data.httpStatus).toBe(404);
    expect(shape.message).toBe("Record not found");
  });

  it("writes the re-mapped status into data.httpStatus so tRPC honours it", () => {
    // `getHTTPStatusCode` prefers `error.data.httpStatus` over deriving a status from the code; without this the wire would still say 500.
    const shape = formatCause(prismaError("P2002"));

    expect(shape.data.code).toBe("CONFLICT");
    expect(shape.data.httpStatus).toBe(409);
  });

  it("keeps an unexpected cause masked in PROD while still reporting a requestId", () => {
    mocks.isProd = true;
    const shape = formatCause(prismaError("P2999"));

    expect(shape.message).toBe("An unexpected error occurred, please try again later.");
    expect(shape.data.requestId).toBe("req-123");
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
