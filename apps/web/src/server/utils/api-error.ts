import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";

import { IS_PROD } from "@/shared/config/env.flags";

import { requestContext } from "./request-context";

/**
 * Transport-agnostic error vocabulary.
 *
 * The codebase already speaks tRPC error codes end to end (services throw
 * `TRPCError`, `core/trpc/init.ts` filters on `error.code`, the client reads
 * `error.code`). Reusing that union here means the HTTP adapter and the tRPC
 * adapter are two serializers over one normalizer instead of two parallel
 * taxonomies, and no new vocabulary has to be learned or translated.
 */
export type ErrorCode = TRPCError["code"];

const GENERIC_MESSAGE = "An unexpected error occurred, please try again later.";

/**
 * Codes whose message is a deliberate, user-facing explanation. Anything not
 * listed here is treated as an internal fault and its message is masked in
 * production — it may embed SQL, file paths, tokens or upstream payloads.
 *
 * `PRECONDITION_FAILED` is included because `fixes.service.ts` and
 * `pr-comments.service.ts` throw it with actionable copy ("install the GitHub
 * App first"); the previous list in `core/trpc/init.ts` omitted it and so hid
 * that copy behind the generic message in production.
 */
const PUBLIC_CODES = new Set<ErrorCode>([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "PARSE_ERROR",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
  "UNAUTHORIZED",
  "UNPROCESSABLE_CONTENT",
]);

/**
 * Maps a code to its HTTP status by delegating to tRPC's own table, so this
 * module cannot drift from what the tRPC procedures already return for the
 * same code. Every one of tRPC's 21 codes is covered without maintaining a
 * local copy.
 */
export function statusForCode(code: ErrorCode): number {
  return getHTTPStatusCodeFromError(new TRPCError({ code }));
}

export function isPublicCode(code: ErrorCode): boolean {
  return PUBLIC_CODES.has(code);
}

/**
 * Which system produced the failure. `kind` is what tells the logger whether a
 * line needs a developer's attention, so it survives normalization instead of
 * being recomputed per transport.
 */
export type ErrorKind = "app" | "octokit" | "prisma" | "trpc" | "unknown" | "zod";

/**
 * Domain-specific copy for a Prisma failure. `uniqueConstraint` is keyed by
 * column name; the rest are single strings. The index signature allows the
 * `custom` key that `users/user.service.ts` passes for a specific code.
 */
export type ErrorMapping = {
  [key: string]: Record<string, string> | string | undefined;
  defaultConflict?: string;
  notFound?: string;
  notNull?: string;
  uniqueConstraint?: Record<string, string>;
};

type AppErrorOptions = {
  cause?: unknown;
  code: ErrorCode;
  /** Message a client may see. Masked in prod unless the code is public. */
  publicMessage?: string;
  /** Set when the input was not a recognized, expected failure. */
  unexpected?: boolean;
  kind?: ErrorKind;
  /** Prisma code (`P2025`) or Octokit HTTP status, when the kind carries one. */
  source?: number | string;
  /** Zod issues, surfaced as `zodError` by the tRPC `errorFormatter`. */
  zodIssues?: unknown;
};

/**
 * The single error type both transports understand. Throw it directly for
 * expected failures (`throw new AppError({ code: "NOT_FOUND", ... })`) — it is
 * the recommended shape for new code, while legacy `TRPCError` throws keep
 * working because `normalizeError` passes them through unchanged.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly isUnexpected: boolean;
  public readonly kind: ErrorKind;
  public readonly publicMessage: string;
  public readonly source: number | string | undefined;
  public readonly zodIssues: unknown;

  constructor(options: AppErrorOptions) {
    super(options.publicMessage ?? GENERIC_MESSAGE, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.isUnexpected = options.unexpected ?? false;
    this.kind = options.kind ?? "app";
    this.publicMessage = options.publicMessage ?? GENERIC_MESSAGE;
    this.source = options.source;
    this.zodIssues = options.zodIssues;
  }

  public get status(): number {
    return statusForCode(this.code);
  }

  /**
   * The message actually safe to put on the wire. Non-public codes are replaced
   * in production so that SQL fragments, upstream tokens and absolute paths
   * never reach a client; the real text is always in the logs.
   */
  public clientMessage(): string {
    return IS_PROD && !isPublicCode(this.code) ? GENERIC_MESSAGE : this.publicMessage;
  }
}

type PrismaErrorMeta = {
  code: ErrorCode;
  defaultMessage: string;
  /** Which `ErrorMapping` entry may override `defaultMessage`. */
  mapKey?: keyof ErrorMapping;
};

/**
 * Prisma's documented known-request error codes. The previous table in
 * `handle-error.ts` covered 11 of these; unmapped codes fell through to a
 * blanket `INTERNAL_SERVER_ERROR`, which turned ordinary, diagnosable
 * conditions (a missing row, a null violation, a stale relation) into opaque
 * 500s.
 */
const PRISMA_ERROR_MAP: Record<string, PrismaErrorMeta> = {
  P1000: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Database authentication failed" },
  P1001: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Database server is unreachable" },
  P1002: { code: "TIMEOUT", defaultMessage: "Database server timed out" },
  P1003: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Database does not exist" },
  P1008: { code: "TIMEOUT", defaultMessage: "Database operation timed out" },
  P1009: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Database is already connected" },
  P1010: { code: "FORBIDDEN", defaultMessage: "Access denied by the database" },
  P1011: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "TLS connection to the database failed" },
  P1017: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Database closed the connection" },
  P2000: { code: "BAD_REQUEST", defaultMessage: "Field value too long for database" },
  P2002: {
    code: "CONFLICT",
    defaultMessage: "Record with this data already exists",
    mapKey: "uniqueConstraint",
  },
  P2003: { code: "BAD_REQUEST", defaultMessage: "Related record not found (invalid ID)" },
  P2004: { code: "BAD_REQUEST", defaultMessage: "A database constraint was violated" },
  P2005: { code: "BAD_REQUEST", defaultMessage: "Stored value does not match the column type" },
  P2006: { code: "BAD_REQUEST", defaultMessage: "Value is outside the allowed range" },
  P2007: { code: "BAD_REQUEST", defaultMessage: "Required field is missing", mapKey: "notNull" },
  P2009: { code: "BAD_REQUEST", defaultMessage: "Value is not a valid text" },
  P2010: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Database query failed" },
  P2011: { code: "BAD_REQUEST", defaultMessage: "A required field must not be null" },
  P2012: { code: "BAD_REQUEST", defaultMessage: "A required field is missing" },
  P2013: { code: "BAD_REQUEST", defaultMessage: "A required argument is missing" },
  P2014: { code: "CONFLICT", defaultMessage: "The change would break a relation" },
  P2015: { code: "BAD_REQUEST", defaultMessage: "Unsupported relation query" },
  P2016: { code: "BAD_REQUEST", defaultMessage: "Query could not be interpreted" },
  P2017: { code: "NOT_FOUND", defaultMessage: "Record not found", mapKey: "notFound" },
  P2018: { code: "NOT_FOUND", defaultMessage: "Related records not found" },
  P2019: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Unsupported database feature" },
  P2020: { code: "BAD_REQUEST", defaultMessage: "Value is outside the allowed range" },
  P2021: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Table does not exist" },
  P2022: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Column does not exist" },
  P2023: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Inconsistent column data" },
  P2024: { code: "TIMEOUT", defaultMessage: "Timed out waiting for a connection from the pool" },
  P2025: { code: "NOT_FOUND", defaultMessage: "Record not found", mapKey: "notFound" },
  P2027: { code: "CONFLICT", defaultMessage: "Record is still referenced elsewhere" },
  P2028: { code: "INTERNAL_SERVER_ERROR", defaultMessage: "Transaction API error" },
  P2030: { code: "BAD_REQUEST", defaultMessage: "Foreign key constraint failed" },
  P2034: {
    code: "BAD_REQUEST",
    defaultMessage: "Conflicting concurrent update, please retry",
    mapKey: "custom",
  },
  P2037: { code: "CONFLICT", defaultMessage: "Write conflict, please retry" },
  P2054: { code: "BAD_REQUEST", defaultMessage: "A value provided to the query is not valid" },
};

const OCTOKIT_STATUS_MAP: Record<number, { code: ErrorCode; message: string }> = {
  401: { code: "UNAUTHORIZED", message: "GitHub token expired" },
  403: { code: "FORBIDDEN", message: "GitHub denied access to this repository" },
  404: { code: "NOT_FOUND", message: "Repository not found on GitHub" },
  429: { code: "TOO_MANY_REQUESTS", message: "GitHub API limit exceeded" },
};

type OctokitError = { message: string; status: number };

export function isOctokitError(error: unknown): error is OctokitError {
  return (
    typeof error === "object" &&
    error != null &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

function isZodError(error: unknown): error is { issues: unknown } {
  return (
    typeof error === "object" &&
    error != null &&
    "issues" in error &&
    Array.isArray((error as Record<string, unknown>).issues) &&
    "name" in error &&
    (error as { name: unknown }).name === "ZodError"
  );
}

/**
 * Resolves the caller's domain copy for a Prisma failure. Kept separate from
 * `normalizeError` so the `uniqueConstraint` column lookup — the only branch
 * with real logic — stays readable and independently testable.
 */
function resolvePrismaMessage(
  error: Prisma.PrismaClientKnownRequestError,
  meta: PrismaErrorMeta,
  map?: ErrorMapping,
): string {
  const fallback = meta.defaultMessage;

  if (meta.mapKey == null || map == null) {
    return fallback;
  }

  if (meta.mapKey === "uniqueConstraint") {
    const constraints = map.uniqueConstraint;

    if (constraints == null) {
      return map.defaultConflict ?? fallback;
    }

    const targetRaw: unknown = error.meta?.target;
    // `Array.isArray` narrows the `any`, and the filter proves the elements
    // are strings rather than asserting it.
    const target: string[] = Array.isArray(targetRaw)
      ? targetRaw.filter((f): f is string => typeof f === "string")
      : typeof targetRaw === "string"
        ? [targetRaw]
        : [];

    for (const field of target) {
      const mapped = constraints[field];
      if (mapped != null) {
        return mapped;
      }
    }

    return map.defaultConflict ?? fallback;
  }

  const override = map[meta.mapKey];

  return typeof override === "string" && override.length > 0 ? override : fallback;
}

/**
 * Walks an error's `cause` chain looking for an `AppError`.
 *
 * Wrapping is the norm, not the exception: undici re-throws a failed
 * `fetch` as `TypeError: fetch failed` with the real error in `cause`, and the
 * same is true of most HTTP and DB clients. Without this, a typed error thrown
 * deep inside a dependency degrades to a generic 500 as soon as anything
 * catches it. The depth is bounded so a cycle in `cause` cannot spin.
 */
export function findAppError(error: unknown, maxDepth = 5): AppError | undefined {
  let current: unknown = error;

  for (let depth = 0; depth <= maxDepth; depth++) {
    if (current instanceof AppError) {
      return current;
    }

    if (typeof current !== "object" || current == null || !("cause" in current)) {
      return undefined;
    }

    current = current.cause;
  }

  return undefined;
}

/**
 * Folds any thrown value into an `AppError`. Pure: it never throws and never
 * logs, so the caller decides what is worth reporting and how loudly. The tRPC
 * adapter and the route-handler adapter then serialize the same result two
 * different ways.
 */
export function normalizeError(error: unknown, map?: ErrorMapping): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const wrapped = findAppError(error);
  if (wrapped != null) {
    return wrapped;
  }

  if (error instanceof TRPCError) {
    return new AppError({
      cause: error,
      code: error.code,
      kind: "trpc",
      publicMessage: error.message,
      zodIssues: error.code === "BAD_REQUEST" ? error.cause : undefined,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = PRISMA_ERROR_MAP[error.code];

    if (meta == null) {
      return new AppError({
        cause: error,
        code: "INTERNAL_SERVER_ERROR",
        kind: "prisma",
        publicMessage: "Database error",
        source: error.code,
        unexpected: true,
      });
    }

    return new AppError({
      cause: error,
      code: meta.code,
      kind: "prisma",
      publicMessage: resolvePrismaMessage(error, meta, map),
      source: error.code,
    });
  }

  if (isZodError(error)) {
    return new AppError({
      cause: error,
      code: "BAD_REQUEST",
      kind: "zod",
      publicMessage: "Invalid request data",
      zodIssues: error.issues,
    });
  }

  if (isOctokitError(error)) {
    const mapped = OCTOKIT_STATUS_MAP[error.status];

    // An unmapped Octokit status (notably 5xx) is an upstream fault, not a
    // client mistake, so it stays unexpected and the original message is kept
    // only for the logs.
    return new AppError({
      cause: error,
      code: mapped?.code ?? "INTERNAL_SERVER_ERROR",
      kind: "octokit",
      publicMessage: mapped?.message ?? GENERIC_MESSAGE,
      source: error.status,
      unexpected: mapped == null,
    });
  }

  const message = error instanceof Error ? error.message : String(error);

  return new AppError({
    cause: error,
    code: "INTERNAL_SERVER_ERROR",
    kind: "unknown",
    publicMessage: message.length > 0 ? message : GENERIC_MESSAGE,
    unexpected: true,
  });
}

/**
 * `next/navigation`'s `redirect()`, `permanentRedirect()`, `notFound()`,
 * `forbidden()` and `unauthorized()` do not return — they throw a control-flow
 * error that Next itself unwinds, keyed by a `digest` prefix. Swallowing one
 * would turn a redirect into a 500, so the route adapter rethrows instead.
 *
 * The check mirrors `isRedirectError` / `isHTTPAccessFallbackError` from
 * `next/dist/client/components/*`, which are internal and must not be imported.
 */
const NEXT_CONTROL_FLOW_PREFIXES = ["NEXT_REDIRECT", "NEXT_HTTP_ERROR_FALLBACK", "NEXT_NOT_FOUND"];

export function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error == null || !("digest" in error)) {
    return false;
  }

  const { digest } = error;

  return typeof digest === "string" && NEXT_CONTROL_FLOW_PREFIXES.some((p) => digest.startsWith(p));
}

type ErrorResponseBody = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  };
};

/**
 * The one wire shape every route handler uses. `requestId` is always present so
 * a user can quote it in a support request and it can be matched against the
 * `requestContext` fields that `appLogger` merges into every log line.
 */
export function toErrorResponse(error: AppError): NextResponse<ErrorResponseBody> {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.clientMessage(),
        requestId: requestContext.getStore()?.requestId ?? "unknown",
      },
    },
    { status: error.status },
  );
}
