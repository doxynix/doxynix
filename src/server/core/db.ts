import crypto from "node:crypto";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg, { Prisma, type PrismaClient as PrismaClientType } from "@prisma/client";
import pg from "pg";
import { fieldEncryptionExtension } from "prisma-field-encryption";
import ws from "ws";

import { IS_DEV, IS_TEST } from "@/shared/constants/env.flags";
import { DATABASE_URL, PRISMA_FIELD_ENCRYPTION_KEY } from "@/shared/constants/env.server";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { AUDIT_BUSINESS_MODELS } from "../utils/constants";
import { requestContext } from "../utils/request-context";
import { sanitizePayload } from "../utils/sanitize-payload";
import { appLogger } from "./app-logger";
import { realtimeServer } from "./realtime";

const { PrismaClient } = pkg;

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

function patchDmmfForEncryption(dmmf: DmmfDatamodel): DmmfDatamodel {
  if (dmmf.datamodel?.models == null) return dmmf;

  for (const model of dmmf.datamodel.models) {
    const modelName = model.name;
    const modelOverrides = ENCRYPTED_METADATA_MAP[modelName];

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

const useNeonAdapter = !IS_TEST && DATABASE_URL.includes("neon.tech");

let baseClient: PrismaClientType;

if (useNeonAdapter) {
  neonConfig.webSocketConstructor = ws;
  const adapter = new PrismaNeon({ connectionString: DATABASE_URL });

  baseClient = new PrismaClient({
    adapter,
    log: IS_DEV && !IS_TEST ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 20_000,
      timeout: 30_000,
    },
  });
} else {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);

  baseClient = new PrismaClient({
    adapter,
    log: IS_DEV && !IS_TEST ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 20_000,
      timeout: 30_000,
    },
  });
}

const encryptedClient = baseClient.$extends(
  fieldEncryptionExtension({
    decryptionKeys: [],
    dmmf: patchDmmfForEncryption(structuredClone(Prisma.dmmf) as unknown as DmmfDatamodel) as any,
    encryptionKey: PRISMA_FIELD_ENCRYPTION_KEY,
  })
);

export const prisma = encryptedClient.$extends({
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
        const mutationOps = ["create", "update", "updateMany", "upsert", "delete", "deleteMany"];

        if (mutationOps.includes(operation) && model !== "AuditLog") {
          const ctxStore = requestContext.getStore();
          const userId = ctxStore?.userId ?? null;
          const requestId = ctxStore?.requestId ?? crypto.randomUUID();

          const cleanPayload = sanitizePayload(args) as Prisma.InputJsonValue;

          (baseClient as PrismaClientType).auditLog
            .create({
              data: {
                ip: ctxStore?.ip ?? null,
                model,
                operation,
                payload: cleanPayload,
                requestId,
                userAgent: ctxStore?.userAgent ?? "internal",
                userId: userId == null ? null : Number(userId),
              },
            })
            .then(() => {
              if (userId != null && AUDIT_BUSINESS_MODELS.includes(model)) {
                const channelName = REALTIME_CONFIG.channels.user(userId);
                return realtimeServer.channels
                  .get(channelName)
                  .publish(REALTIME_CONFIG.events.user.auditUpdated, {});
              }
              return null;
            })
            .catch((error) => {
              appLogger.error({ error, msg: "AUDIT LOG WRITE FAILED" });
            });

          if (!IS_TEST) {
            appLogger.info({
              durationMs: duration.toFixed(2),
              model,
              msg: `DB Write: ${model}.${operation}`,
              operation,
              type: "db.write",
            });
          }
        } else if (duration > 200) {
          appLogger.warn({
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
