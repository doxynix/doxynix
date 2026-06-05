import crypto from "node:crypto";
import type { after as NextAfterFn } from "next/server";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { fieldEncryptionExtension } from "prisma-field-encryption";

import { IS_DEV, IS_TEST } from "@/shared/constants/env.flags";
import {
  DATABASE_URL,
  PRISMA_FIELD_ENCRYPTION_DECRYPTION_KEYS,
  PRISMA_FIELD_ENCRYPTION_KEY,
} from "@/shared/constants/env.server";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { AUDIT_BUSINESS_MODELS } from "../utils/constants";
import { requestContext } from "../utils/request-context";
import { sanitizePayload } from "../utils/sanitize-payload";
import { appLogger } from "./app-logger";
import { realtimeServer } from "./realtime";

type DmmfField = {
  documentation?: string;
  isId?: boolean;
  isList?: boolean;
  isUnique?: boolean;
  name: string;
};

type DmmfModel = {
  fields?: DmmfField[];
  name: string;
};

type DmmfDatamodel = {
  datamodel?: {
    models?: DmmfModel[];
  };
};

const ENCRYPTED_METADATA_MAP: Record<string, Record<string, string>> = {
  Account: {
    access_token: "/// @encrypted",
    email: "/// @encrypted",
    emailHash: "/// @encryption:hash(email)?normalize=lowercase&normalize=trim",
    id_token: "/// @encrypted",
    refresh_token: "/// @encrypted",
  },
  BannedEmail: {
    email: "/// @encrypted",
    emailHash: "/// @encryption:hash(email)?normalize=lowercase&normalize=trim",
  },
  ChatMessage: {
    parts: "/// @encrypted",
  },
  Session: {
    sessionToken: "/// @encrypted",
    sessionTokenHash: "/// @encryption:hash(sessionToken)",
  },
  User: {
    email: "/// @encrypted",
    emailHash: "/// @encryption:hash(email)?normalize=lowercase&normalize=trim",
  },
  VerificationToken: {
    identifier: "/// @encrypted",
    identifierHash: "/// @encryption:hash(identifier)?normalize=lowercase&normalize=trim",
    token: "/// @encrypted",
    tokenHash: "/// @encryption:hash(token)",
  },
};

/**
 * Модифицирует AST-схему (DMMF) Prisma на лету, инжектируя метаданные для шифрования.
 * Это необходимо для совместимости с Rust-free компилятором Prisma 6/7 (engineType="client"),
 * который по умолчанию вырезает triple-slash комментарии из генерируемого клиента.
 *
 * @param dmmf Исходная DMMF-модель Prisma
 * @returns Патченная DMMF-модель с аннотациями шифрования
 */
function patchDmmfForEncryption(dmmf: DmmfDatamodel): DmmfDatamodel {
  if (dmmf.datamodel?.models == null) return dmmf;

  for (const model of dmmf.datamodel.models) {
    const modelOverrides = ENCRYPTED_METADATA_MAP[model.name];
    if (model.fields == null) continue;

    for (const field of model.fields) {
      if (field.isList === undefined) field.isList = false;
      if (field.isUnique === undefined) field.isUnique = false;
      if (field.isId === undefined) {
        field.isId = field.name === "id";
      }

      if (modelOverrides != null && modelOverrides[field.name] != null) {
        field.documentation = modelOverrides[field.name];
      }
    }
  }
  return dmmf;
}

/**
 * Гарантирует, что метаданные DMMF успешно загружены и содержат модели.
 * Предотвращает молчаливую регрессию безопасности, когда из-за tree-shaking
 * сборщика DMMF оказывается пустым, и персональные данные пишутся в БД в открытом виде.
 *
 * @param dmmf Модель DMMF для проверки
 */
function assertDmmfIsPopulated(dmmf: DmmfDatamodel): void {
  const models = dmmf.datamodel?.models;
  if (models == null || models.length === 0) {
    throw new Error(
      "[db] Prisma.dmmf is empty or stripped by the bundler. " +
        "Field encryption cannot work without a valid DMMF — aborting startup to prevent unencrypted data leak."
    );
  }
}

let cachedAfterFn: null | typeof NextAfterFn = null;
let isAfterChecked = false;

async function getNextAfterApi() {
  if (isAfterChecked) return cachedAfterFn;
  try {
    const { after } = await import("next/server");
    cachedAfterFn = after;
  } catch {
    cachedAfterFn = null;
  }
  isAfterChecked = true;
  return cachedAfterFn;
}

/**
 * Запускает фоновую задачу логирования аудита.
 * Использует Next.js after() для неблокирующего выполнения в продакшене.
 * В случае отсутствия API (скрипты, тесты, сбои) принудительно дожидается выполнения
 * через await во избежание заморозки процесса в Serverless-среде (Vercel Lambda).
 *
 * @param task Асинхронная функция фоновой задачи
 */
async function runAsBackgroundTask(task: () => Promise<void>): Promise<void> {
  const afterFn = await getNextAfterApi();

  if (afterFn) {
    try {
      afterFn(task);
      return;
    } catch (error) {
      appLogger.error({ error, msg: "afterFn failed, falling back to blocking await" });
    }
  }

  await task().catch((error) => {
    appLogger.error({ error, msg: "Background task failed in fallback mode" });
  });
}

/**
 * Фабрика для ленивой инициализации синглтона базы данных Prisma.
 * Динамически выбирает TCP-драйвер PrismaPg для Node.js рантаймов и
 * WebSocket-драйвер PrismaNeon для Edge-рантаймов Next.js.
 *
 * Накладные расходы метода structuredClone на копирование DMMF выполняются строго единожды
 * при холодном старте (Cold Start) инстанса и не влияют на время обработки запросов (TTFB).
 */
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

  const rawDmmf =
    (Prisma as any).dmmf != null
      ? (structuredClone((Prisma as any).dmmf) as unknown as DmmfDatamodel)
      : null;

  if (rawDmmf === null) {
    throw new Error(
      "[db] Prisma.dmmf is undefined. " +
        "Field encryption cannot initialize — aborting startup to prevent unencrypted data leak."
    );
  }

  assertDmmfIsPopulated(rawDmmf);

  const patchedDmmf = patchDmmfForEncryption(rawDmmf);

  const encryptedClient = baseClient.$extends(
    fieldEncryptionExtension({
      decryptionKeys,
      dmmf: patchedDmmf as any,
      encryptionKey: PRISMA_FIELD_ENCRYPTION_KEY,
    })
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
            const cleanPayload = sanitizePayload(args) as Prisma.InputJsonValue;

            const logAuditTask = async () => {
              try {
                await baseClient.auditLog.create({
                  data: {
                    ip: ctxStore?.ip ?? null,
                    model,
                    operation,
                    payload: cleanPayload,
                    requestId,
                    userAgent: ctxStore?.userAgent ?? "internal",
                    userId: userId == null ? null : Number(userId),
                  },
                });

                if (userId != null && AUDIT_BUSINESS_MODELS.includes(model)) {
                  const channelName = REALTIME_CONFIG.channels.user(userId);
                  await realtimeServer.channels
                    .get(channelName)
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

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientExtended };

export const prisma = globalForPrisma.prisma ?? createPrismaInstance();

if (IS_DEV) {
  globalForPrisma.prisma = prisma;
}
