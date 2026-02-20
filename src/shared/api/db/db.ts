import { PrismaPg } from "@prisma/adapter-pg";
import pkg, { type PrismaClient as PrismaClientType } from "@prisma/client";
import pg from "pg";

import { IS_DEV, IS_TEST } from "@/shared/constants/env.client";
import { DATABASE_URL } from "@/shared/constants/env.server";
import { logger } from "@/shared/lib/logger";
import { sanitizePayload } from "@/shared/lib/utils";

import { requestContext } from "@/server/utils/request-context";

const { PrismaClient } = pkg;
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});
const adapter = new PrismaPg(pool);

export const baseClient = new PrismaClient({
  adapter,
  log: IS_DEV && !IS_TEST ? ["error", "warn"] : ["error"],
  transactionOptions: {
    maxWait: 20000,
    timeout: 30000,
  },
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

          (baseClient as PrismaClientType).auditLog
            .create({
              data: {
                model,
                operation,
                payload: sanitizePayload(args),
                userId: userId != null ? Number(userId) : null,
                ip: ctxStore?.ip ?? "system",
                userAgent: ctxStore?.userAgent ?? "internal",
                requestId: ctxStore?.requestId ?? "unknown",
              },
            })
            .catch((auditErr) => {
              logger.error({ msg: "AUDIT LOG WRITE FAILED", error: auditErr });
            });

          if (!IS_TEST) {
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

if (IS_DEV) {
  globalForPrisma.prisma = prisma;
}
