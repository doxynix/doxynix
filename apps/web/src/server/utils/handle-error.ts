import { TRPCError } from "@trpc/server";

import { appLogger } from "@/server/core/app-logger";

import { type AppError, type ErrorMapping, normalizeError } from "./api-error";

// Mapping tables live in ./api-error so HTTP route handlers and tRPC procedures cannot drift apart.
function toTrpcError(error: AppError): TRPCError {
  return new TRPCError({
    cause: error.zodIssues,
    code: error.code,
    message: error.publicMessage,
  });
}

// Logs only unrecognized failures: a mapped P2025 is an expected NOT_FOUND that core/trpc/init.ts's loggerMiddleware already records.
export function handlePrismaError(error: unknown, map?: ErrorMapping): never {
  if (error instanceof TRPCError) {
    throw error;
  }

  const normalized = normalizeError(error, map);

  if (normalized.kind === "unknown") {
    appLogger.error({ error, msg: "Unknown Prisma Error:" });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Internal database error" });
  }

  if (normalized.kind === "prisma" && normalized.isUnexpected) {
    appLogger.error({
      error,
      msg: `Unhandled Prisma Error Code:${normalized.source ?? "unknown"}`,
    });
  }

  throw toTrpcError(normalized);
}

export { isOctokitError } from "./api-error";

// Returns undefined for statuses this app has no copy for, so the caller rethrows the original error untouched.
export function toOctokitTrpcError(error: unknown): TRPCError | undefined {
  const normalized = normalizeError(error);

  if (normalized.kind !== "octokit" || normalized.isUnexpected) {
    return undefined;
  }

  return toTrpcError(normalized);
}
