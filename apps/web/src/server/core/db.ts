import crypto from "node:crypto";

import type { after as NextAfterFn } from "next/server";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "@prisma/client";

import { IS_DEV, IS_TEST } from "@/shared/config/env.flags";
import {
  DATABASE_URL,
  PRISMA_FIELD_ENCRYPTION_DECRYPTION_KEYS,
  PRISMA_FIELD_ENCRYPTION_KEY,
} from "@/shared/config/env.server";
import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { AUDIT_BUSINESS_MODELS } from "../utils/constants";
import { requestContext } from "../utils/request-context";
import { maskSensitiveFields, sanitizePayload } from "../utils/sanitize-payload";
import { appLogger } from "./app-logger";
import { fieldEncryptionExtension } from "./field-encryption";
import { realtimeService } from "./realtime";

let cachedAfterFn: null | typeof NextAfterFn = null;
let isAfterChecked = false;

async function getNextAfterApi() {
  if (isAfterChecked) {
    return cachedAfterFn;
  }
  try {
    const { after } = await import("next/server");
    cachedAfterFn = after;
  } catch {
    cachedAfterFn = null;
  }
  isAfterChecked = true;
  return cachedAfterFn;
}

// Prefers Next.js `after()` and falls back to a direct await elsewhere; the import is dynamic so Trigger.dev tasks and builds, which have no Next.js request context, still work.
async function runAsBackgroundTask(task: () => Promise<void>): Promise<void> {
  const afterFn = await getNextAfterApi();

  if (afterFn) {
    try {
      afterFn(task);
      return;
    } catch (error) {
      const isContextError =
        error instanceof Error &&
        (error.message.includes("request context") || error.message.includes("lifecycle"));

      if (!isContextError) {
        appLogger.warn({ error, msg: "afterFn failed unexpectedly, falling back to execution" });
      }
    }
  }

  if (IS_DEV || IS_TEST) {
    task().catch((error) => {
      appLogger.error({ error, msg: "Background task failed in local environment" });
    });
    return;
  }

  await task().catch((error) => {
    appLogger.error({ error, msg: "Background task failed in production fallback mode" });
  });
}

// Lazy singleton: PrismaPg over TCP on Node runtimes, PrismaNeon over WebSocket on Edge.
function createPrismaInstance() {
  let baseClient: PrismaClient;

  const logConfig =
    IS_DEV && !IS_TEST
      ? (["error", "warn"] as Prisma.LogLevel[])
      : (["error"] as Prisma.LogLevel[]);

  const transactionOptions = {
    maxWait: 20_000,
    timeout: 30_000,
  };

  const isEdgeRuntime =
    (typeof globalThis !== "undefined" && "EdgeRuntime" in globalThis) ||
    process.env.NEXT_RUNTIME === "edge";

  if (isEdgeRuntime) {
    const adapter = new PrismaNeon({ connectionString: DATABASE_URL });
    baseClient = new PrismaClient({
      adapter,
      log: logConfig,
      transactionOptions,
    });
  } else {
    const adapter = new PrismaPg({ connectionString: DATABASE_URL });
    baseClient = new PrismaClient({
      adapter,
      log: logConfig,
      transactionOptions,
    });
  }

  const decryptionKeys =
    PRISMA_FIELD_ENCRYPTION_DECRYPTION_KEYS != null
      ? PRISMA_FIELD_ENCRYPTION_DECRYPTION_KEYS.split(",")
      : [];

  const encryptedClient = baseClient.$extends(
    fieldEncryptionExtension({
      decryptionKeys,
      encryptionKey: PRISMA_FIELD_ENCRYPTION_KEY,
    }),
  );

  return encryptedClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, model, operation, query }) {
          const start = performance.now();
          let result;
          try {
            result = await query(args);
          } catch (error) {
            appLogger.error({
              error: error instanceof Error ? error.message : String(error),
              model,
              msg: `DB Error: ${model}.${operation}`,
              operation,
            });
            throw error;
          }

          const duration = performance.now() - start;
          const mutationOps = [
            "create",
            "createMany",
            "createManyAndReturn",
            "update",
            "updateMany",
            "updateManyAndReturn",
            "upsert",
            "delete",
            "deleteMany",
          ];

          if (mutationOps.includes(operation) && model !== "AuditLog") {
            const ctxStore = requestContext.getStore();
            const userId = ctxStore?.userId ?? null;
            const requestId = ctxStore?.requestId ?? crypto.randomUUID();

            const cleanPayload = sanitizePayload(args);
            const securedPayload = maskSensitiveFields(
              model,
              cleanPayload,
            ) as Prisma.InputJsonValue;

            const logAuditTask = async () => {
              try {
                await baseClient.auditLog.create({
                  data: {
                    ip: ctxStore?.ip ?? null,
                    model,
                    operation,
                    payload: securedPayload,
                    requestId,
                    userAgent: ctxStore?.userAgent ?? "internal",
                    userId: userId ?? null,
                  },
                });

                if (userId != null && AUDIT_BUSINESS_MODELS.includes(model)) {
                  await realtimeService
                    .user(userId)
                    .publish(REALTIME_CONFIG.events.user.auditUpdated, {});
                }
              } catch (error) {
                appLogger.error({ error, msg: "AUDIT LOG WRITE FAILED" });
              }
            };

            await runAsBackgroundTask(logAuditTask);

            if (!IS_TEST) {
              appLogger.info({
                durationMs: Number(duration.toFixed(2)),
                model,
                msg: `DB Write: ${model}.${operation}`,
                operation,
                type: "db.write",
              });
            }
          } else if (duration > 200) {
            appLogger.warn({
              durationMs: Number(duration.toFixed(2)),
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
}

export type PrismaClientExtended = ReturnType<typeof createPrismaInstance>;

export type TransactionClient = Parameters<Parameters<PrismaClientExtended["$transaction"]>[0]>[0];

export type DbClient = PrismaClientExtended | TransactionClient;

// Irreducible: `globalThis` has no `prisma`; this is the Next.js dev-HMR singleton idiom, so one client is reused across hot reloads instead of leaking pools.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientExtended };

export const prisma = globalForPrisma.prisma ?? createPrismaInstance();

if (IS_DEV) {
  globalForPrisma.prisma = prisma;
}
