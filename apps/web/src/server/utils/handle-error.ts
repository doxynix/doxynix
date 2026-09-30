import { TRPCError } from "@trpc/server";

import { appLogger } from "@/server/core/app-logger";

import { type AppError, type ErrorMapping, normalizeError } from "./api-error";

/**
 * tRPC adapter over the shared normalizer in `./api-error`.
 *
 * Both transports fold an arbitrary throw into one `AppError`; this file only
 * decides how that travels to a tRPC client. The Prisma and Octokit mapping
 * tables live in `./api-error` precisely so the HTTP route handlers and the
 * tRPC procedures cannot drift apart — the previous version of this file owned
 * them alone, which is why ten of the sixteen route handlers had to invent
 * their own ad-hoc equivalents.
 */
function toTrpcError(error: AppError): TRPCError {
  return new TRPCError({
    cause: error.zodIssues,
    code: error.code,
    message: error.publicMessage,
  });
}

/**
 * Translates a caught error into a `TRPCError` and throws it. Call this at the
 * end of a `catch` block that wraps a Prisma call; the domain-specific `map`
 * refines the message for the codes it names.
 *
 * This is the tRPC-side counterpart of `withApiHandler`. It deliberately logs
 * only the *unrecognized* failures — a mapped `P2025` is an expected
 * `NOT_FOUND` and `core/trpc/init.ts`'s `loggerMiddleware` already records it.
 */
export function handlePrismaError(error: unknown, map?: ErrorMapping): never {
  if (error instanceof TRPCError) {
    throw error;
  }

  const normalized = normalizeError(error, map);

  if (normalized.kind === "unknown") {
    // Not a Prisma failure at all, so its message may embed an upstream payload.
    // Collapse it to a fixed string and keep the detail in the log.
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

/**
 * Maps an Octokit HTTP failure to a `TRPCError`, or returns `undefined` when
 * the status is not one this app has copy for so the caller can rethrow the
 * original error untouched.
 */
export function toOctokitTrpcError(error: unknown): TRPCError | undefined {
  const normalized = normalizeError(error);

  if (normalized.kind !== "octokit" || normalized.isUnexpected) {
    return undefined;
  }

  return toTrpcError(normalized);
}
