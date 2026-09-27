import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { appLogger } from "@/server/core/app-logger";

type ErrorMapping = {
  [key: string]: Record<string, string> | string | undefined;
  defaultConflict?: string;
  notFound?: string;
  notNull?: string;
  uniqueConstraint?: Record<string, string>;
};

type PrismaErrorMeta = {
  code: TRPCError["code"];
  defaultMessage: string;
  mapKey?: keyof ErrorMapping;
};

const prismaErrorMap: Record<string, PrismaErrorMeta | undefined> = {
  P2000: {
    code: "BAD_REQUEST",
    defaultMessage: "Field value too long for database",
    mapKey: "custom",
  },
  P2002: {
    code: "CONFLICT",
    defaultMessage: "Record with this data already exists",
    mapKey: "uniqueConstraint",
  },
  P2003: {
    code: "BAD_REQUEST",
    defaultMessage: "Related record not found (invalid ID)",
    mapKey: "custom",
  },
  P2004: {
    code: "FORBIDDEN",
    defaultMessage: "Access denied by security policy",
    mapKey: "custom",
  },
  P2006: {
    code: "CONFLICT",
    defaultMessage: "Data was modified by another user",
    mapKey: "custom",
  },
  P2007: {
    code: "BAD_REQUEST",
    defaultMessage: "Required field is missing",
    mapKey: "notNull",
  },
  P2010: {
    code: "INTERNAL_SERVER_ERROR",
    defaultMessage: "Database query failed",
    mapKey: "custom",
  },
  P2016: { code: "NOT_FOUND", defaultMessage: "Record not found", mapKey: "notFound" },
  P2025: { code: "NOT_FOUND", defaultMessage: "Record not found", mapKey: "notFound" },
  P2030: {
    code: "BAD_REQUEST",
    defaultMessage: "Foreign key constraint failed",
    mapKey: "custom",
  },
  P2034: {
    code: "BAD_REQUEST",
    defaultMessage: "Conflicting concurrent update, please retry",
    mapKey: "custom",
  },
};

export function handlePrismaError(error: unknown, map?: ErrorMapping): never {
  if (error instanceof TRPCError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = prismaErrorMap[error.code];

    if (meta == null) {
      appLogger.error({ error, msg: `Unhandled Prisma Error Code:${error.code}` });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database error" });
    }

    let message: string = meta.defaultMessage;

    if (meta.mapKey != null) {
      const mapValue = map?.[meta.mapKey];

      if (meta.mapKey === "uniqueConstraint") {
        const targetRaw = error.meta?.target;
        const target: string[] = Array.isArray(targetRaw)
          ? (targetRaw as string[])
          : typeof targetRaw === "string"
            ? [targetRaw]
            : [];

        const field = target.find((f): f is string => map?.uniqueConstraint?.[f] != null);

        if (field != null && map?.uniqueConstraint?.[field] != null) {
          message = map.uniqueConstraint[field];
        } else if (map?.defaultConflict != null) {
          message = map.defaultConflict;
        }
      } else if (typeof mapValue === "string" && mapValue.length > 0) {
        message = mapValue;
      }
    }

    throw new TRPCError({ code: meta.code, message });
  }

  appLogger.error({ error, msg: "Unknown Prisma Error:" });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal database error",
  });
}

type OctokitError = {
  message: string;
  status: number;
};

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

type OctokitStatusMapping = {
  code: TRPCError["code"];
  message: string;
};

const octokitStatusMap: Record<number, OctokitStatusMapping> = {
  401: { code: "UNAUTHORIZED", message: "GitHub token expired" },
  403: { code: "FORBIDDEN", message: "GitHub denied access to this repository" },
  404: { code: "NOT_FOUND", message: "Repository not found on GitHub" },
  429: { code: "TOO_MANY_REQUESTS", message: "GitHub API limit exceeded" },
};

export function toOctokitTrpcError(error: unknown): TRPCError | undefined {
  if (!isOctokitError(error)) {
    return undefined;
  }

  const mapping = octokitStatusMap[error.status];

  return mapping == null
    ? undefined
    : new TRPCError({ code: mapping.code, message: mapping.message });
}
