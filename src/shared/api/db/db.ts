/* eslint-disable */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

import { requestContext } from "@/server/utils/requestContext";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const baseClient = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["error", "warn", "info", "query"] : ["error"],
});

const softDeleteClient = baseClient.$extends({
  query: {
    apiKey: {
      async delete({ args }) {
        return baseClient.apiKey.update({
          where: args.where,
          data: { revoked: true },
        });
      },
      async deleteMany({ args }) {
        return baseClient.apiKey.updateMany({
          where: args.where,
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
        const ctx = requestContext.getStore();

        const mutationOps = ["create", "update", "updateMany", "upsert", "delete", "deleteMany"];

        if (mutationOps.includes(operation) && model !== "AuditLog") {
          const finalArgs = args as any;
          const rawUserId = finalArgs?.data?.userId ?? finalArgs?.where?.userId;
          const auditUserId = typeof rawUserId === "number" ? rawUserId : null;

          let payloadToLog = {};
          try {
            payloadToLog = JSON.parse(JSON.stringify(finalArgs));
          } catch (e) {
            payloadToLog = { error: "Circular structure or stringify failed" };
          }

          const sensitiveFields = [
            "password",
            "newPassword",
            "confirmPassword",
            "passwordHash",
            "hash",
            "salt",

            "token",
            "session_token",
            "sessionToken",
            "verificationToken",
            "identifier",

            "access_token",
            "accessToken",
            "refresh_token",
            "refreshToken",
            "id_token",
            "idToken",
            "session_state",

            "hashedKey",
            "secret",
            "clientSecret",
            "clientId",

            // "email",
            // "phone",
            // "phoneNumber",

            "cvv",
            "creditCard",
            "cardNumber",
            "iban",
          ];

          const sanitize = (obj: any) => {
            if (!obj || typeof obj !== "object") return;
            Object.keys(obj).forEach((key) => {
              if (sensitiveFields.includes(key)) {
                obj[key] = "***REDACTED***";
              } else if (typeof obj[key] === "object") {
                sanitize(obj[key]);
              }
            });
          };

          sanitize(payloadToLog);

          (baseClient as any).auditLog
            .create({
              data: {
                model: model,
                operation: operation,
                payload: payloadToLog,
                userId: auditUserId,
                ip: ctx?.ip ?? "system",
                userAgent: ctx?.userAgent ?? "internal",
              },
            })
            .catch((err: any) => console.error("Audit Log Failed:", err));
        }

        const result = await query(args);

        const duration = performance.now() - start;
        if (duration > 200) {
          console.warn(`[Prisma Slow Query] ${model}.${operation} took ${duration.toFixed(2)}ms`);
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
