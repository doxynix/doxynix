import { setTimeout as sleep } from "node:timers/promises";

import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { del } from "@vercel/blob";

import { appLogger } from "@/server/core/app-logger";
import { auth } from "@/server/core/auth";
import {
  type DbClient,
  type PrismaClientExtended,
  prisma,
  type TransactionClient,
} from "@/server/core/db";
import { handlePrismaError } from "@/server/utils/handle-error";

import { userMapper } from "./user.mapper";

export function assertCanDisconnectAccount(input: {
  accountCount: number;
  hasEmailAuth: boolean;
}): void {
  if (input.accountCount <= 1 && !input.hasEmailAuth) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You cannot disconnect your only authentication method. Add another one first.",
    });
  }
}

async function deleteAvatarBlob(input: {
  key: string;
  logField: "imageKey" | "keyToDelete";
  msg: string;
  userId: number;
}): Promise<void> {
  try {
    await del(input.key);
  } catch (error) {
    appLogger.error({
      error: error instanceof Error ? error.message : String(error),
      [input.logField]: input.key,
      msg: input.msg,
      userId: input.userId,
    });
  }
}

const SERIALIZABLE_MAX_ATTEMPTS = 3;
const SERIALIZABLE_RETRY_BASE_MS = 20;
const SERIALIZABLE_RETRY_JITTER_MS = 10;

function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function serializableRetryDelayMs(attempt: number): number {
  return (
    SERIALIZABLE_RETRY_BASE_MS * 2 ** (attempt - 1) + Math.random() * SERIALIZABLE_RETRY_JITTER_MS
  );
}

type PolicyEnforcedDb = Pick<PrismaClientExtended, "$transaction">;

function asPolicyEnforcedDb(db: DbClient): PolicyEnforcedDb {
  if (!("$transaction" in db)) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "disconnectAccount requires a non-transactional database client",
    });
  }

  return db;
}

async function runSerializableTransaction(
  db: PolicyEnforcedDb,
  body: (tx: TransactionClient) => Promise<void>,
): Promise<void> {
  for (let attempt = 1; attempt <= SERIALIZABLE_MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(body, { isolationLevel: "Serializable" });
    } catch (error) {
      if (!isWriteConflict(error) || attempt === SERIALIZABLE_MAX_ATTEMPTS) {
        handlePrismaError(error, {
          custom: "This account was modified by another request. Please try again.",
        });
      }

      await sleep(serializableRetryDelayMs(attempt));
    }
  }
}

export const userService = {
  async deleteAccount(db: DbClient, userId: number) {
    const user = await prisma.user.findUnique({
      select: { imageKey: true },
      where: { id: userId },
    });

    if (user == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    await db.user.delete({ where: { id: userId } });

    if (user.imageKey != null) {
      await deleteAvatarBlob({
        key: user.imageKey,
        logField: "imageKey",
        msg: "Failed to delete avatar on account deletion",
        userId,
      });
    }

    return {
      message: "Your account and all associated data have been permanently deleted",
      success: true,
    };
  },

  async disconnectAccount(db: DbClient, userId: number, provider: "github" | "google" | "yandex") {
    await runSerializableTransaction(asPolicyEnforcedDb(db), async (tx) => {
      const accountToDelete = await tx.account.findUnique({
        where: { userId_providerId: { providerId: provider, userId } },
      });

      if (accountToDelete == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found or already disconnected.",
        });
      }

      const accountCount = await tx.account.count({ where: { userId } });

      const user = await tx.user.findUnique({
        select: { email: true, emailVerified: true },
        where: { id: userId },
      });

      const hasEmailAuth = user?.email != null && user.emailVerified;

      assertCanDisconnectAccount({ accountCount, hasEmailAuth });

      await tx.account.delete({
        where: { userId_providerId: { providerId: provider, userId } },
      });
    });

    return { success: true };
  },
  async getActiveSessions(headers: Headers, isApiKeySession: boolean) {
    if (isApiKeySession) {
      return [];
    }

    const sessions = await auth.api.listSessions({ headers });

    return sessions
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((session) => userMapper.toSession(session));
  },

  async getLinkedAccounts(db: DbClient, userId: number) {
    const [accounts, user] = await Promise.all([
      db.account.findMany({
        orderBy: { providerId: "asc" },
        select: {
          accountId: true,
          email: true,
          image: true,
          name: true,
          providerId: true,
        },
        where: { userId },
      }),
      db.user.findUnique({
        select: { email: true, emailVerified: true },
        where: { id: userId },
      }),
    ]);

    const mappedAccounts = accounts.map((acc) => userMapper.toLinkedAccount(acc));

    return { accounts: mappedAccounts, user };
  },
  async getMe(db: DbClient, userId: number) {
    const user = await db.user.findUnique({ where: { id: userId } });

    if (user == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return { message: "User found", user: userMapper.toPublic(user) };
  },

  async removeAvatar(db: DbClient, userId: number) {
    // NOTE: uses plain Prisma
    const user = await prisma.user.findUnique({
      select: { imageKey: true },
      where: { id: userId },
    });

    const keyToDelete = user?.imageKey;

    await db.user.update({
      data: { image: null, imageKey: null },
      where: { id: userId },
    });

    if (keyToDelete != null) {
      await deleteAvatarBlob({
        key: keyToDelete,
        logField: "keyToDelete",
        msg: "Failed to delete avatar from Vercel Blob during removal",
        userId,
      });
    }

    return { message: "Profile Picture removed", success: true };
  },
  async revokeSession(headers: Headers, sessionId: string) {
    const sessions = await auth.api.listSessions({ headers });
    const target = sessions.find((session) => session.id === sessionId);

    if (target == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
    }

    await auth.api.revokeSession({ body: { token: target.token }, headers });

    return { success: true };
  },

  async updateUser(db: DbClient, userId: number, input: { name: string }) {
    const updatedUser = await db.user.update({
      data: { name: input.name },
      where: { id: userId },
    });

    return { message: "Credentials updated", user: userMapper.toPublic(updatedUser) };
  },
};
