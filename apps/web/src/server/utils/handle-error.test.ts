import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handlePrismaError, toOctokitTrpcError } from "@/server/utils/handle-error";

type KnownErrorOptions = {
  clientVersion: string;
  code: string;
  meta?: {
    target?: string | string[];
  };
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

const loggerState = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("@prisma/client/runtime/library", () => ({
  PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
}));

vi.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
  },
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: loggerState,
}));

function captureTrpcError(run: () => never): TRPCError {
  try {
    run();
  } catch (error) {
    if (error instanceof TRPCError) {
      return error;
    }
    throw error;
  }
}

describe("handlePrismaError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should rethrow incoming TRPCError without remapping", () => {
    const inputError = new TRPCError({
      code: "BAD_REQUEST",
      message: "Original",
    });

    const trpcError = captureTrpcError(() => handlePrismaError(inputError));

    expect(trpcError).toBe(inputError);
  });

  it("should map P2002 unique constraint and use field specific message", () => {
    const error = new PrismaClientKnownRequestError("Unique failed", {
      clientVersion: "test",
      code: "P2002",
      meta: { target: ["githubId"] },
    });
    const map = {
      defaultConflict: "Conflict default",
      uniqueConstraint: {
        githubId: "This repository is already added",
      },
    };

    const trpcError = captureTrpcError(() => handlePrismaError(error, map));

    expect(trpcError.code).toBe("CONFLICT");
    expect(trpcError.message).toBe("This repository is already added");
  });

  it("should map P2002 unique constraint when target is provided as string", () => {
    const error = new PrismaClientKnownRequestError("Unique failed", {
      clientVersion: "test",
      code: "P2002",
      meta: { target: "githubId" },
    });
    const map = {
      uniqueConstraint: {
        githubId: "This repository is already added",
      },
    };

    const trpcError = captureTrpcError(() => handlePrismaError(error, map));

    expect(trpcError.code).toBe("CONFLICT");
    expect(trpcError.message).toBe("This repository is already added");
  });

  it("should map P2002 unique constraint and fallback to defaultConflict when field is not mapped", () => {
    const error = new PrismaClientKnownRequestError("Unique failed", {
      clientVersion: "test",
      code: "P2002",
      meta: { target: ["url"] },
    });
    const map = {
      defaultConflict: "Conflict default",
      uniqueConstraint: {
        githubId: "This repository is already added",
      },
    };

    const trpcError = captureTrpcError(() => handlePrismaError(error, map));

    expect(trpcError.code).toBe("CONFLICT");
    expect(trpcError.message).toBe("Conflict default");
  });

  it("should map P2025 to NOT_FOUND and use custom notFound message", () => {
    const error = new PrismaClientKnownRequestError("Record not found", {
      clientVersion: "test",
      code: "P2025",
    });
    const map = {
      notFound: "Repository not found",
    };

    const trpcError = captureTrpcError(() => handlePrismaError(error, map));

    expect(trpcError.code).toBe("NOT_FOUND");
    expect(trpcError.message).toBe("Repository not found");
  });

  it("should map non-unique mapKey errors using string map value", () => {
    const error = new PrismaClientKnownRequestError("Not null failed", {
      clientVersion: "test",
      code: "P2007",
    });
    const map = {
      notNull: "Custom required field message",
    };

    const trpcError = captureTrpcError(() => handlePrismaError(error, map));

    expect(trpcError.code).toBe("BAD_REQUEST");
    expect(trpcError.message).toBe("Custom required field message");
  });

  it("should map P2034 to BAD_REQUEST with the default concurrency message", () => {
    const error = new PrismaClientKnownRequestError("Transaction failed", {
      clientVersion: "test",
      code: "P2034",
    });

    const trpcError = captureTrpcError(() => handlePrismaError(error));

    expect(trpcError.code).toBe("BAD_REQUEST");
    expect(trpcError.message).toBe("Conflicting concurrent update, please retry");
  });

  it("should let a caller's custom message override the P2034 default", () => {
    const error = new PrismaClientKnownRequestError("Transaction failed", {
      clientVersion: "test",
      code: "P2034",
    });
    const map = {
      custom: "This account was modified by another request. Please try again.",
    };

    const trpcError = captureTrpcError(() => handlePrismaError(error, map));

    expect(trpcError.code).toBe("BAD_REQUEST");
    expect(trpcError.message).toBe(
      "This account was modified by another request. Please try again.",
    );
  });

  it("should map P2010 to INTERNAL_SERVER_ERROR, not NOT_FOUND", () => {
    const error = new PrismaClientKnownRequestError("Raw query failed", {
      clientVersion: "test",
      code: "P2010",
    });

    const trpcError = captureTrpcError(() => handlePrismaError(error));

    expect(trpcError.code).toBe("INTERNAL_SERVER_ERROR");
    expect(trpcError.message).toBe("Database query failed");
    expect(loggerState.error).not.toHaveBeenCalled();
  });

  it("should not apply a caller's notFound message to a P2010 raw query failure", () => {
    const error = new PrismaClientKnownRequestError("Raw query failed", {
      clientVersion: "test",
      code: "P2010",
    });
    const map = {
      notFound: "Repository not found",
    };

    const trpcError = captureTrpcError(() => handlePrismaError(error, map));

    expect(trpcError.code).toBe("INTERNAL_SERVER_ERROR");
    expect(trpcError.message).toBe("Database query failed");
  });

  it("should return INTERNAL_SERVER_ERROR for unhandled prisma error code", () => {
    const error = new PrismaClientKnownRequestError("Unhandled prisma code", {
      clientVersion: "test",
      code: "P2999",
    });

    const trpcError = captureTrpcError(() => handlePrismaError(error));

    expect(trpcError.code).toBe("INTERNAL_SERVER_ERROR");
    expect(trpcError.message).toBe("Database error");
    expect(loggerState.error).toHaveBeenCalledWith({
      error,
      msg: "Unhandled Prisma Error Code:P2999",
    });
  });

  it("should return INTERNAL_SERVER_ERROR for non-prisma errors and log unknown error", () => {
    const error = { message: "boom" };

    const trpcError = captureTrpcError(() => handlePrismaError(error));

    expect(trpcError.code).toBe("INTERNAL_SERVER_ERROR");
    expect(trpcError.message).toBe("Internal database error");
    expect(loggerState.error).toHaveBeenCalledWith({
      error,
      msg: "Unknown Prisma Error:",
    });
  });
});

describe("toOctokitTrpcError", () => {
  it("should map 401 to UNAUTHORIZED with token expired message", () => {
    const trpcError = toOctokitTrpcError({ message: "Bad credentials", status: 401 });

    expect(trpcError?.code).toBe("UNAUTHORIZED");
    expect(trpcError?.message).toBe("GitHub token expired");
  });

  it("should map 403 to FORBIDDEN with denied access message", () => {
    const trpcError = toOctokitTrpcError({ message: "Forbidden", status: 403 });

    expect(trpcError?.code).toBe("FORBIDDEN");
    expect(trpcError?.message).toBe("GitHub denied access to this repository");
  });

  it("should map 404 to NOT_FOUND with repository not found message", () => {
    const trpcError = toOctokitTrpcError({ message: "Not Found", status: 404 });

    expect(trpcError?.code).toBe("NOT_FOUND");
    expect(trpcError?.message).toBe("Repository not found on GitHub");
  });

  it("should map 429 to TOO_MANY_REQUESTS with API limit message", () => {
    const trpcError = toOctokitTrpcError({ message: "Too many requests", status: 429 });

    expect(trpcError?.code).toBe("TOO_MANY_REQUESTS");
    expect(trpcError?.message).toBe("GitHub API limit exceeded");
  });

  it("should return undefined for unmapped octokit statuses so the caller rethrows", () => {
    const trpcError = toOctokitTrpcError({ message: "Server Error", status: 500 });

    expect(trpcError).toBeUndefined();
  });

  it("should return undefined for non-octokit errors", () => {
    const trpcError = toOctokitTrpcError(new Error("boom"));

    expect(trpcError).toBeUndefined();
  });
});
