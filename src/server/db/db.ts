import { PrismaPg } from "@prisma/adapter-pg";
import pkg, { type PrismaClient as PrismaClientType } from "@prisma/client";
import pg from "pg";

import { IS_DEV, IS_TEST } from "@/shared/constants/env.client";
import { DATABASE_URL } from "@/shared/constants/env.server";
import { sanitizePayload } from "@/shared/lib/utils";

import { logger } from "../logger/logger";
import { requestContext } from "../utils/request-context";

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
      async $allOperations({ args, model, operation, query }) {
        const start = performance.now();

        let result;
        try {
          result = await query(args);
        } catch (error) {
          logger.error({
            error: error instanceof Error ? error.message : String(error),
            model,
            msg: `DB Error: ${model}.${operation}`,
            operation,
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
                ip: ctxStore?.ip ?? "system",
                model,
                operation,
                payload: sanitizePayload(args),
                requestId: ctxStore?.requestId ?? "unknown",
                userAgent: ctxStore?.userAgent ?? "internal",
                userId: userId == null ? null : Number(userId),
              },
            })
            .catch((error_) => {
              logger.error({ error: error_, msg: "AUDIT LOG WRITE FAILED" });
            });

          if (!IS_TEST) {
            logger.info({
              durationMs: duration.toFixed(2),
              model,
              msg: `DB Write: ${model}.${operation}`,
              operation,
              type: "db.write",
            });
          }
        } else if (duration > 200) {
          logger.warn({
            durationMs: duration.toFixed(2),
            model,
            msg: "Slow DB Query",
            operation,
            type: "db.slow",
          });
        }

        return result;
      },
    },
  },
});

export type PrismaClientExtended = typeof prisma;

export type TransactionClient = Parameters<Parameters<PrismaClientExtended["$transaction"]>[0]>[0];

export type DbClient = PrismaClientExtended | TransactionClient;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientExtended };

if (IS_DEV) {
  globalForPrisma.prisma = prisma;
}
