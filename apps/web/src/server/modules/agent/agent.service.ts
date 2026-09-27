import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/core/db";

import { agentMapper } from "./agent.mapper";

export type CreateSessionInput = {
  repoId?: string;
  title: string;
};

export type ListSessionsInput = {
  currentRepo?: { name: string; owner: string };
};

export const agentService = {
  async createSession(db: DbClient, userId: number, input: CreateSessionInput) {
    let internalRepoId: number | undefined;

    if (input.repoId != null) {
      const repo = await db.repo.findFirst({
        select: { id: true },
        where: { publicId: input.repoId, userId },
      });

      if (repo == null) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found or access denied",
        });
      }

      internalRepoId = repo.id;
    }

    return db.chatSession.create({
      data: { repoId: internalRepoId, title: input.title, userId },
    });
  },

  async getSessionHistory(db: DbClient, userId: number, sessionId: string) {
    const rawMessages = await db.chatMessage.findMany({
      orderBy: { createdAt: "asc" },
      where: { session: { userId }, sessionId },
    });

    return rawMessages.map((msg) => agentMapper.toSessionMessage(msg));
  },

  async listSessions(db: DbClient, userId: number, input: ListSessionsInput | undefined) {
    let internalRepoId: null | number = null;

    if (input?.currentRepo != null) {
      const repo = await db.repo.findUnique({
        select: { id: true },
        where: {
          owner_name_userId: {
            name: input.currentRepo.name,
            owner: input.currentRepo.owner,
            userId,
          },
        },
      });
      if (repo != null) {
        internalRepoId = repo.id;
      }
    }

    return db.chatSession.findMany({
      include: { repo: { select: { name: true, owner: true } } },
      orderBy: { updatedAt: "desc" },
      where: { repoId: internalRepoId, userId },
    });
  },
};
