import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";

import { IS_PROD } from "@/shared/config/env.flags";

import { requestContext } from "./request-context";

// Reuses tRPC's union so the HTTP and tRPC adapters are two serializers over one normalizer, not two taxonomies.
export type ErrorCode = TRPCError["code"];

const GENERIC_MESSAGE = "An unexpected error occurred, please try again later.";

// Anything not listed here is masked in production, since its message may embed SQL, file paths, tokens or upstream payloads.
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

// Delegates to tRPC's own table so this module cannot drift from what tRPC procedures already return for the same code.
export function statusForCode(code: ErrorCode): number {
  return getHTTPStatusCodeFromError(new TRPCError({ code }));
}

export function isPublicCode(code: ErrorCode): boolean {
  return PUBLIC_CODES.has(code);
}

// `kind` tells the logger whether a line needs a developer's attention, so it survives normalization instead of being recomputed per transport.
export type ErrorKind = "app" | "octokit" | "prisma" | "trpc" | "unknown" | "zod";

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

// The single error type both transports understand; legacy TRPCError throws still pass through normalizeError unchanged.
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

// Unmapped codes fall through to a blanket INTERNAL_SERVER_ERROR, so cover Prisma's known-request codes to keep ordinary faults diagnosable.
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
    // The filter proves elements are strings rather than asserting it.
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

// undici re-throws a failed fetch as `TypeError: fetch failed` with the real error in `cause`, so a typed error thrown inside a dependency would otherwise degrade to a generic 500. Depth is bounded so a `cause` cycle cannot spin.
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

// Never throws and never logs, so the caller decides what is worth reporting; both adapters serialize the same result differently.
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

    // An unmapped Octokit status (notably 5xx) is an upstream fault, not a client mistake.
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

// next/navigation's redirect()/notFound()/forbidden()/unauthorized() throw a control-flow error Next unwinds itself; swallowing one would turn a redirect into a 500. Mirrors the internal next/dist helpers, which must not be imported.
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

// `requestId` is always present so a user can quote it and it can be matched against the requestContext fields appLogger merges into every log line.
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
