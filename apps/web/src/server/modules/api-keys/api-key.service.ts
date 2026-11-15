import { ApiKeyScope, isApiKeyDead, MessageCode } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { AppError } from "@/server/core/api-error";
import type { DbClient } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";
import { handlePrismaError } from "@/server/utils/handle-error";
import { extractPayloadFromKey, generateApiKey, getApiKeyHash } from "@/server/utils/hash";
import { keysetArgs, orderWithTiebreak, splitKeysetPage } from "@/server/utils/pagination";

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

type ListKeysInput = {
  cursor?: null | string;
  limit: number;
};

const ROTATION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const API_KEY_SELECT = {
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
} satisfies Prisma.ApiKeySelect;

// Mirrors `isApiKeyDead` in SQL: a key with an open grace window is live, otherwise revoked or
// expired means dead. Keep the two predicates in step — the unit test walks their truth table.
function activeKeyWhere(now: Date): Prisma.ApiKeyWhereInput {
  return {
    OR: [
      { revokedAfter: { gt: now } },
      {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        revoked: false,
        revokedAfter: null,
      },
    ],
  };
}

function archivedKeyWhere(now: Date): Prisma.ApiKeyWhereInput {
  return {
    OR: [
      { revokedAfter: { lte: now } },
      { revoked: true, revokedAfter: null },
      { expiresAt: { lte: now }, revoked: false, revokedAfter: null },
    ],
  };
}

function normalizeKey(key: Prisma.ApiKeyGetPayload<{ select: typeof API_KEY_SELECT }>) {
  return {
    ...key,
    scopes: key.scopes.length > 0 ? key.scopes : [ApiKeyScope.FULL],
  };
}

export const apiKeyService = {
  async create(db: DbClient, userId: string, workspaceId: string, input: CreateKeyInput) {
    const fullKey = generateApiKey();
    const displayPrefix = fullKey.slice(0, 11);
    const payload = extractPayloadFromKey(fullKey);

    if (payload == null) {
      throw new AppError({
        code: "INTERNAL_SERVER_ERROR",
        messageCode: MessageCode.API_KEY_INTEGRITY_FAILED,
        publicMessage: "Failed to process and validate generated API key integrity.",
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
        defaultConflict: "Could not create the API key",
        uniqueConstraint: {
          hashedKey: "Incredible, but a duplicate key was generated. Try again.",
        },
      });
    }

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.apiKeyUpdated, {});

    return { key: fullKey };
  },

  async list(db: DbClient, workspaceId: string, input: ListKeysInput) {
    const { cursor, limit } = input;
    const now = new Date();

    const rows = await db.apiKey.findMany({
      ...keysetArgs(cursor, limit),
      orderBy: orderWithTiebreak("createdAt", "desc"),
      select: API_KEY_SELECT,
      where: { workspaceId, ...activeKeyWhere(now) },
    });

    const { hasNextPage, items, nextCursor } = splitKeysetPage(rows, limit);

    return {
      items: items.map(normalizeKey),
      meta: { hasNextPage, nextCursor },
    };
  },

  async listArchived(db: DbClient, workspaceId: string, input: ListKeysInput) {
    const { cursor, limit } = input;

    const rows = await db.apiKey.findMany({
      ...keysetArgs(cursor, limit),
      orderBy: orderWithTiebreak("createdAt", "desc"),
      select: API_KEY_SELECT,
      where: { workspaceId, ...archivedKeyWhere(new Date()) },
    });

    const { hasNextPage, items, nextCursor } = splitKeysetPage(rows, limit);

    return {
      items: items.map(normalizeKey),
      meta: { hasNextPage, nextCursor },
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
    const rotateKey = async (client: DbClient) => {
      const existing = await client.apiKey.findFirst({ where: { id, workspaceId } });

      if (existing == null || isApiKeyDead(existing, Date.now())) {
        throw new AppError({
          code: "NOT_FOUND",
          messageCode: MessageCode.API_KEY_NOT_FOUND,
          publicMessage: "Key not found",
        });
      }

      const fullKey = generateApiKey();
      const payload = extractPayloadFromKey(fullKey);

      if (payload == null) {
        throw new AppError({
          code: "INTERNAL_SERVER_ERROR",
          messageCode: MessageCode.API_KEY_INTEGRITY_FAILED,
          publicMessage: "Failed to process and validate generated API key integrity.",
        });
      }

      const replacement = await client.apiKey.create({
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

      await client.apiKey.update({
        data: { revoked: true, revokedAfter: new Date(Date.now() + ROTATION_GRACE_MS) },
        where: { id, workspaceId },
      });

      return { fullKey, replacement };
    };

    // Create-then-revoke must be atomic: a crash between the two would leave the old key live forever.
    const { fullKey, replacement } =
      "$transaction" in db ? await db.$transaction(rotateKey) : await rotateKey(db);

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
      throw new AppError({
        code: "NOT_FOUND",
        messageCode: MessageCode.API_KEY_NOT_FOUND_OR_DENIED,
        publicMessage: "API Key not found or access denied",
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
            scopes: input.scopes.length > 0 ? input.scopes : [ApiKeyScope.FULL],
          }),
          name: input.name,
        },
        where: { id: input.id, workspaceId },
      })
      .then((result) => result.count)
      .catch((error) =>
        handlePrismaError(error, {
          notFound: "Key not found or access denied",
        }),
      );

    if (count === 0) {
      throw new AppError({
        code: "NOT_FOUND",
        messageCode: MessageCode.API_KEY_NOT_FOUND_OR_DENIED,
        publicMessage: "Key not found or access denied",
      });
    }

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.apiKeyUpdated, {});

    return { success: true };
  },
};
