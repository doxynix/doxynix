import type { ApiKeyScope } from "@doxynix/shared";
import { TRPCError } from "@trpc/server";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { DbClient } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";
import { handlePrismaError } from "@/server/utils/handle-error";
import { extractPayloadFromKey, generateApiKey, getApiKeyHash } from "@/server/utils/hash";

type CreateKeyInput = {
  description?: string;
  expiresAt?: Date | null;
  name: string;
  scopes: ApiKeyScope[];
};

type UpdateKeyInput = {
  description?: string;
  expiresAt?: Date | null;
  id: string;
  name: string;
  scopes?: ApiKeyScope[];
};

const ROTATION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function isApiKeyDead(
  key: {
    expiresAt: Date | null;
    revoked: boolean;
    revokedAfter: Date | null;
  },
  now: number,
): boolean {
  if (key.revokedAfter != null) {
    return key.revokedAfter.getTime() <= now;
  }

  if (key.revoked) {
    return true;
  }

  return key.expiresAt != null && key.expiresAt.getTime() <= now;
}

export const apiKeyService = {
  async create(db: DbClient, userId: string, workspaceId: string, input: CreateKeyInput) {
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
          expiresAt: input.expiresAt ?? null,
          hashedKey,
          name: input.name,
          prefix: displayPrefix,
          scopes: input.scopes,
          userId,
          workspaceId,
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

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.apiKeyUpdated, {});

    return { key: fullKey };
  },

  async list(db: DbClient, workspaceId: string) {
    const allKeys = await db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        description: true,
        expiresAt: true,
        id: true,
        lastUsed: true,
        name: true,
        prefix: true,
        revoked: true,
        revokedAfter: true,
        scopes: true,
        updatedAt: true,
      },
      where: { workspaceId },
    });

    const now = Date.now();

    const isRetired = (k: (typeof allKeys)[number]) =>
      isApiKeyDead(
        { expiresAt: k.expiresAt, revoked: k.revoked, revokedAfter: k.revokedAfter },
        now,
      );
    const normalize = (k: (typeof allKeys)[number]) => ({
      ...k,
      scopes: (k.scopes.length > 0 ? k.scopes : (["FULL"] as ApiKeyScope[])) as ApiKeyScope[],
    });

    return {
      active: allKeys.filter((k) => !isRetired(k)).map(normalize),
      archived: allKeys.filter(isRetired).map(normalize),
    };
  },

  async revoke(db: DbClient, id: string, userId: string, workspaceId: string) {
    try {
      await db.apiKey.update({
        data: { revoked: true, revokedAfter: null },
        where: { id, workspaceId },
      });

      void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.apiKeyUpdated, {});

      return { success: true };
    } catch (error) {
      handlePrismaError(error, { notFound: "Key not found" });
    }
  },

  async rotate(db: DbClient, id: string, userId: string, workspaceId: string) {
    const existing = await db.apiKey.findFirst({ where: { id, workspaceId } });

    if (existing == null || isApiKeyDead(existing, Date.now())) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Key not found" });
    }

    const fullKey = generateApiKey();
    const payload = extractPayloadFromKey(fullKey);

    if (payload == null) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to process and validate generated API key integrity.",
      });
    }

    const replacement = await db.apiKey.create({
      data: {
        description: existing.description,
        expiresAt: existing.expiresAt,
        hashedKey: getApiKeyHash(payload),
        name: existing.name,
        prefix: fullKey.slice(0, 11),
        scopes: existing.scopes,
        userId,
        workspaceId,
      },
    });

    await db.apiKey.update({
      data: { revoked: true, revokedAfter: new Date(Date.now() + ROTATION_GRACE_MS) },
      where: { id },
    });

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.apiKeyUpdated, {});

    return {
      gracePeriodDays: ROTATION_GRACE_MS / (24 * 60 * 60 * 1000),
      id: replacement.id,
      key: fullKey,
    };
  },

  async touch(db: DbClient, id: string, userId: string, workspaceId: string) {
    const count = await db.apiKey
      .updateMany({ data: { lastUsed: new Date() }, where: { id, workspaceId } })
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

  async update(db: DbClient, input: UpdateKeyInput, userId: string, workspaceId: string) {
    const count = await db.apiKey
      .updateMany({
        data: {
          description: input.description,
          ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
          ...(input.scopes !== undefined && {
            scopes: input.scopes.length > 0 ? input.scopes : (["FULL"] as ApiKeyScope[]),
          }),
          name: input.name,
        },
        where: { id: input.id, workspaceId },
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

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.apiKeyUpdated, {});

    return { success: true };
  },
};
