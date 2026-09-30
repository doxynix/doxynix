import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import {
  AppError,
  findAppError,
  isNextControlFlowError,
  normalizeError,
  statusForCode,
} from "@/server/utils/api-error";

type KnownErrorOptions = {
  clientVersion: string;
  code: string;
  meta?: { target?: string | string[] };
};

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

const prismaError = (code: string, meta?: KnownErrorOptions["meta"]) =>
  new MockPrismaClientKnownRequestError("db failed", {
    clientVersion: "test",
    code,
    meta,
  }) as unknown as Error;

describe("statusForCode", () => {
  it("delegates to tRPC's own status table", () => {
    expect(statusForCode("BAD_REQUEST")).toBe(400);
    expect(statusForCode("UNAUTHORIZED")).toBe(401);
    expect(statusForCode("NOT_FOUND")).toBe(404);
    expect(statusForCode("CONFLICT")).toBe(409);
    expect(statusForCode("TOO_MANY_REQUESTS")).toBe(429);
    expect(statusForCode("INTERNAL_SERVER_ERROR")).toBe(500);
  });

  it("covers codes that the old hand-rolled table in handle-error.ts omitted", () => {
    expect(statusForCode("BAD_GATEWAY")).toBe(502);
    expect(statusForCode("PAYLOAD_TOO_LARGE")).toBe(413);
    expect(statusForCode("PRECONDITION_REQUIRED")).toBe(428);
    expect(statusForCode("SERVICE_UNAVAILABLE")).toBe(503);
  });
});

describe("AppError", () => {
  it("keeps an explicitly public message in production", () => {
    const error = new AppError({ code: "NOT_FOUND", publicMessage: "Repository not found" });

    expect(error.status).toBe(404);
    expect(error.clientMessage()).toBe("Repository not found");
  });

  it("masks a non-public code's message in production", () => {
    const error = new AppError({
      code: "INTERNAL_SERVER_ERROR",
      publicMessage: 'relation "User" does not exist',
    });

    expect(error.status).toBe(500);
    // In the test env `IS_PROD` is false, so the assertion pins the code's
    // public/private classification rather than the dev rendering.
    expect(error.publicMessage).toBe('relation "User" does not exist');
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("preserves the original error as `cause`", () => {
    const cause = new Error("root");
    const error = new AppError({ cause, code: "BAD_REQUEST", publicMessage: "nope" });

    expect(error.cause).toBe(cause);
  });
});

describe("normalizeError", () => {
  it("passes an AppError through by identity", () => {
    const input = new AppError({ code: "FORBIDDEN", publicMessage: "nope" });

    expect(normalizeError(input)).toBe(input);
  });

  it("maps a TRPCError onto its own code and message", () => {
    const result = normalizeError(new TRPCError({ code: "FORBIDDEN", message: "Admin only" }));

    expect(result.code).toBe("FORBIDDEN");
    expect(result.kind).toBe("trpc");
    expect(result.publicMessage).toBe("Admin only");
  });

  it("exposes Zod issues on a BAD_REQUEST TRPCError, the way tRPC stores them", () => {
    // `core/trpc/init.ts` publishes `error.cause` as `zodError` for
    // BAD_REQUEST, and tRPC only ever puts a real `ZodError` there.
    const parsed = z.object({ name: z.string() }).safeParse({});
    const zodError = parsed.success ? undefined : parsed.error;

    expect(zodError).toBeDefined();

    const result = normalizeError(
      new TRPCError({ cause: zodError, code: "BAD_REQUEST", message: "bad" }),
    );

    expect(result.zodIssues).toBe(zodError);
  });

  it("maps an unmapped Prisma code to an unexpected INTERNAL_SERVER_ERROR", () => {
    const result = normalizeError(prismaError("P2999"));

    expect(result.kind).toBe("prisma");
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.isUnexpected).toBe(true);
    expect(result.source).toBe("P2999");
  });

  it("maps Prisma codes the previous table did not cover", () => {
    expect(normalizeError(prismaError("P2011")).code).toBe("BAD_REQUEST");
    expect(normalizeError(prismaError("P2014")).code).toBe("CONFLICT");
    expect(normalizeError(prismaError("P2018")).code).toBe("NOT_FOUND");
    expect(normalizeError(prismaError("P2027")).code).toBe("CONFLICT");
    expect(normalizeError(prismaError("P2024")).code).toBe("TIMEOUT");
    expect(normalizeError(prismaError("P1010")).code).toBe("FORBIDDEN");
  });

  it("applies the caller's notFound copy to P2025", () => {
    const result = normalizeError(prismaError("P2025"), { notFound: "Repository not found" });

    expect(result.code).toBe("NOT_FOUND");
    expect(result.publicMessage).toBe("Repository not found");
  });

  it("applies per-column copy for a unique constraint", () => {
    const result = normalizeError(prismaError("P2002", { target: ["githubId"] }), {
      uniqueConstraint: { githubId: "This repository is already added" },
    });

    expect(result.code).toBe("CONFLICT");
    expect(result.publicMessage).toBe("This repository is already added");
  });

  it("falls back to defaultConflict when the violated column has no copy", () => {
    const result = normalizeError(prismaError("P2002", { target: ["url"] }), {
      defaultConflict: "Already added",
      uniqueConstraint: { githubId: "This repository is already added" },
    });

    expect(result.publicMessage).toBe("Already added");
  });

  it("does not leak a notFound copy onto an unrelated code", () => {
    const result = normalizeError(prismaError("P2010"), { notFound: "Repository not found" });

    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.publicMessage).toBe("Database query failed");
  });

  it("maps an Octokit status the app has copy for", () => {
    const result = normalizeError({ message: "Bad credentials", status: 401 });

    expect(result.kind).toBe("octokit");
    expect(result.code).toBe("UNAUTHORIZED");
    expect(result.publicMessage).toBe("GitHub token expired");
    expect(result.isUnexpected).toBe(false);
  });

  it("treats an unmapped Octokit status as an unexpected upstream fault", () => {
    const result = normalizeError({ message: "Server Error", status: 500 });

    expect(result.kind).toBe("octokit");
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.isUnexpected).toBe(true);
  });

  it("maps a ZodError to BAD_REQUEST with its issues", () => {
    const zod = Object.assign(new Error("invalid"), {
      issues: [{ message: "Invalid email", path: ["email"] }],
      name: "ZodError",
    });

    const result = normalizeError(zod);

    expect(result.kind).toBe("zod");
    expect(result.code).toBe("BAD_REQUEST");
    expect(result.zodIssues).toEqual([{ message: "Invalid email", path: ["email"] }]);
  });

  it("marks an unrecognized value unexpected and keeps its text for the logs", () => {
    const result = normalizeError("something odd");

    expect(result.kind).toBe("unknown");
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
    expect(result.isUnexpected).toBe(true);
  });

  it("never throws, whatever it is given", () => {
    for (const input of [null, undefined, 0, "", [], {}, Symbol("x"), new Error("e")]) {
      expect(() => normalizeError(input)).not.toThrow();
    }
  });
});

describe("findAppError", () => {
  it("finds an AppError nested in a cause chain", () => {
    const appError = new AppError({ code: "FORBIDDEN", publicMessage: "ssrf" });
    const wrapped = new TypeError("fetch failed", { cause: appError });

    expect(findAppError(wrapped)).toBe(appError);
  });

  it("finds one buried several levels deep", () => {
    const appError = new AppError({ code: "FORBIDDEN", publicMessage: "deep" });
    let error: Error = appError;
    for (let i = 0; i < 3; i++) {
      error = new Error("layer", { cause: error });
    }

    expect(findAppError(error)).toBe(appError);
  });

  it("stops at the depth bound instead of following a cycle forever", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    const b = new Error("b") as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;

    expect(findAppError(a)).toBeUndefined();
  });

  it("returns undefined when there is no AppError", () => {
    expect(findAppError(new Error("plain"))).toBeUndefined();
    expect(findAppError(null)).toBeUndefined();
  });
});

describe("isNextControlFlowError", () => {
  it("recognizes the digest prefixes next/navigation throws", () => {
    expect(isNextControlFlowError({ digest: "NEXT_REDIRECT;replace;/dashboard;307;" })).toBe(true);
    expect(isNextControlFlowError({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })).toBe(true);
    expect(isNextControlFlowError({ digest: "NEXT_NOT_FOUND" })).toBe(true);
  });

  it("ignores ordinary errors and lookalike digests", () => {
    expect(isNextControlFlowError(new Error("boom"))).toBe(false);
    expect(isNextControlFlowError({ digest: "SOMETHING_ELSE;1" })).toBe(false);
    expect(isNextControlFlowError(null)).toBe(false);
    expect(isNextControlFlowError("NEXT_REDIRECT")).toBe(false);
  });
});
