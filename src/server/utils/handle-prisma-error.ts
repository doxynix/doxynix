import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { logger } from "@/server/logger/logger";

type ErrorMapping = {
  [key: string]: string | Record<string, string> | undefined;
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
  P2010: { code: "NOT_FOUND", defaultMessage: "Record not found", mapKey: "notFound" },
  P2016: { code: "NOT_FOUND", defaultMessage: "Record not found", mapKey: "notFound" },
  P2025: { code: "NOT_FOUND", defaultMessage: "Record not found", mapKey: "notFound" },
  P2030: {
    code: "BAD_REQUEST",
    defaultMessage: "Foreign key constraint failed",
    mapKey: "custom",
  },
  P2034: { code: "BAD_REQUEST", defaultMessage: "Data constraint error", mapKey: "custom" },
};

export function handlePrismaError(error: unknown, map?: ErrorMapping): never {
  if (error instanceof TRPCError) throw error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = prismaErrorMap[error.code];

    if (meta == null) {
      logger.error({ error, msg: "Unhandled Prisma Error Code:" + error.code });
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

  logger.error({ error, msg: "Unknown Prisma Error:" });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal database error",
  });
}
