import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/core/db";
import { handlePrismaError } from "@/server/utils/handle-error";
import { extractPayloadFromKey, generateApiKey, getApiKeyHash } from "@/server/utils/hash";

export type CreateKeyInput = {
  description?: string;
  name: string;
};

export type UpdateKeyInput = CreateKeyInput & { id: string };

export const apiKeyService = {
  async create(db: DbClient, userId: number, input: CreateKeyInput) {
    const fullKey = generateApiKey();
    const displayPrefix = fullKey.slice(0, 11);
    const payload = extractPayloadFromKey(fullKey);

    if (payload == null) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to process and validate generated API key integrity.",
      });
    }

    const hashedKey = getApiKeyHash(payload);

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
      select: {
        createdAt: true,
        description: true,
        id: true,
        lastUsed: true,
        name: true,
        prefix: true,
        revoked: true,
        updatedAt: true,
      },
    });

    return {
      active: allKeys.filter((k) => !k.revoked),
      archived: allKeys.filter((k) => k.revoked),
    };
  },

  async revoke(db: DbClient, id: string) {
    try {
      await db.apiKey.update({ data: { revoked: true }, where: { id } });

      return { message: "API Key revoked", success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Key not found" });
    }
  },

  async touch(db: DbClient, id: string) {
    const count = await db.apiKey
      .updateMany({ data: { lastUsed: new Date() }, where: { id } })
      .then((result) => result.count)
      .catch((error) => handlePrismaError(error));

    if (count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "API Key not found or access denied",
      });
    }

    return { success: true };
  },

  async update(db: DbClient, input: UpdateKeyInput) {
    const count = await db.apiKey
      .updateMany({
        data: { description: input.description, name: input.name },
        where: { id: input.id },
      })
      .then((result) => result.count)
      .catch((error) =>
        handlePrismaError(error, {
          defaultConflict: "API Key with this name already exists",
          notFound: "Key not found or access denied",
          uniqueConstraint: { name: "Name already taken" },
        }),
      );

    if (count === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Key not found or access denied",
      });
    }

    return { message: "API Key data updated", success: true };
  },
};
