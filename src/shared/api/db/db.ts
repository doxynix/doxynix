/* eslint-disable */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { logger } from "@/shared/lib/logger";

import { requestContext } from "@/server/utils/requestContext";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const isTest = process.env.NODE_ENV === "test";

const baseClient = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === "development" && !isTest
      ? ["error", "warn", "info", "query"]
      : ["error"],
});

const softDeleteClient = baseClient.$extends({
  query: {
    apiKey: {
      async delete({ args }) {
        return baseClient.apiKey.update({
          ...args,
          data: { revoked: true },
        });
      },
      async deleteMany({ args }) {
        return baseClient.apiKey.updateMany({
          ...args,
          data: { revoked: true },
        });
      },
    },
  },
});

const SENSITIVE_FIELDS = new Set([
  "password",
  "newPassword",
  "passwordHash",
  "hash",
  "salt",
  "token",
  "sessionToken",
  "verificationToken",
  "identifier",
  "access_token",
  "refresh_token",
  "id_token",
  "hashedKey",
  "secret",
  "clientSecret",
  "cvv",
  "creditCard",
  "iban",
]);

const sanitizePayload = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }

  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (SENSITIVE_FIELDS.has(key)) {
        newObj[key] = "***REDACTED***";
      } else {
        newObj[key] = sanitizePayload(obj[key]);
      }
    }
  }
  return newObj;
};

export const prisma = softDeleteClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const start = performance.now();

        let result;
        try {
          result = await query(args);
        } catch (error) {
          logger.error({
            msg: `DB Error: ${model}.${operation}`,
            model,
            operation,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        const duration = performance.now() - start;
        const mutationOps = ["create", "update", "updateMany", "upsert", "delete", "deleteMany"];

        if (mutationOps.includes(operation) && model !== "AuditLog") {
          const ctxStore = requestContext.getStore();
          const userId = ctxStore?.userId ?? null;

          try {
            await (baseClient as any).auditLog.create({
              data: {
                model,
                operation,
                payload: sanitizePayload(args),
                userId: userId !== null ? Number(userId) : null,
                ip: ctxStore?.ip ?? "system",
                userAgent: ctxStore?.userAgent ?? "internal",
                requestId: ctxStore?.requestId ?? "unknown",
              },
            });
          } catch (auditErr) {
            logger.error({ msg: "AUDIT WRITE FAILED", error: auditErr });
          }

          if (!isTest) {
            logger.info({
              msg: `DB Write: ${model}.${operation}`,
              type: "db.write",
              model,
              operation,
              durationMs: duration.toFixed(2),
            });
          }
        } else if (duration > 200) {
          logger.warn({
            msg: "Slow DB Query",
            type: "db.slow",
            model,
            operation,
            durationMs: duration.toFixed(2),
          });
        }

        return result;
      },
    },
  },
});

export type PrismaClientExtended = typeof prisma;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientExtended };

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
