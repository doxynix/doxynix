import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/shared/infrastructure/db";
import { handlePrismaError } from "@/server/shared/lib/handle-error";

const BRAND_PREFIX = "dxnx_";

export const apiKeyService = {
  async create(db: DbClient, userId: number, input: { description?: string | null; name: string }) {
    const randomPart = crypto.randomBytes(32).toString("hex");
    const fullKey = `${BRAND_PREFIX}${randomPart}`;
    const displayPrefix = `${BRAND_PREFIX}${randomPart.slice(0, 6)}`;
    const hashedKey = crypto.createHash("sha256").update(fullKey).digest("hex");

    try {
      await db.apiKey.create({
        data: {
          description: input.description,
          hashedKey,
          name: input.name,
          prefix: displayPrefix,
          userId,
        },
      });
    } catch (error) {
      handlePrismaError(error, {
        defaultConflict: "API Key with this name already exists",
        uniqueConstraint: {
          hashedKey: "Incredible, but a duplicate key was generated. Try again.",
          name: "API Key with this name already exists",
        },
      });
    }

    return { key: fullKey, message: "API Key created" };
  },

  async list(db: DbClient) {
    const allKeys = await db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        OR: [{ revoked: true }, { revoked: false }],
      },
    });

    return {
      active: allKeys.filter((k) => k.revoked === false),
      archived: allKeys.filter((k) => k.revoked),
    };
  },

  async revoke(db: DbClient, id: string) {
    try {
      await db.apiKey.delete({
        where: { id },
      });

      return { message: "API Key revoked", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Key not found" });
    }
  },

  async touch(db: DbClient, id: string) {
    const result = await db.apiKey
      .updateMany({
        data: { lastUsed: new Date() },
        where: { id },
      })
      .catch((error) => {
        handlePrismaError(error);
      });

    if (result.count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "API Key not found or access denied",
      });
    }

    return { success: true };
  },

  async update(db: DbClient, id: string, input: { description?: string | null; name: string }) {
    try {
      const data = await db.apiKey.updateMany({
        data: { description: input.description, name: input.name },
        where: { id },
      });

      if (data.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Key not found or access denied",
        });
      }

      return { message: "API Key data updated", success: true };
    } catch (error) {
      handlePrismaError(error, {
        defaultConflict: "API Key with this name already exists",
        notFound: "Key not found or access denied",
        uniqueConstraint: { name: "Name already taken" },
      });
    }
  },
};
