import { MessageCode } from "@doxynix/shared";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { AppError } from "@/server/core/api-error";
import type { DbClient } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";

import { agentMapper } from "./agent.mapper";

export type CreateSessionInput = {
  repoId?: string;
  title: string;
};

export type ListSessionsInput = {
  currentRepo?: { name: string; owner: string };
};

export type UpdateSessionInput = {
  sessionId: string;
  title: string;
};

export type DeleteSessionInput = {
  sessionId: string;
};

export const agentService = {
  async createSession(
    db: DbClient,
    userId: string,
    workspaceId: string,
    input: CreateSessionInput,
  ) {
    let internalRepoId: string | undefined;

    if (input.repoId != null) {
      const repo = await db.repo.findFirst({
        select: { id: true },
        where: { id: input.repoId, workspaceId },
      });

      if (repo == null) {
        throw new AppError({
          code: "NOT_FOUND",
          messageCode: MessageCode.REPO_NOT_FOUND_OR_DENIED,
          publicMessage: "Repository not found or access denied",
        });
      }

      internalRepoId = repo.id;
    }

    const session = await db.chatSession.create({
      data: { repoId: internalRepoId, title: input.title, userId },
    });

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.agentSessionUpdated, {});

    return session;
  },

  async deleteSession(db: DbClient, userId: string, input: DeleteSessionInput) {
    const session = await db.chatSession.delete({
      select: { id: true },
      where: { id: input.sessionId, userId },
    });

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.agentSessionUpdated, {});

    return session;
  },

  async getSessionHistory(db: DbClient, userId: string, sessionId: string) {
    const rawMessages = await db.chatMessage.findMany({
      orderBy: { createdAt: "asc" },
      where: { session: { userId }, sessionId },
    });

    return rawMessages.map((msg) => agentMapper.toSessionMessage(msg));
  },

  async listSessions(
    db: DbClient,
    userId: string,
    workspaceId: string,
    input: ListSessionsInput | undefined,
  ) {
    let internalRepoId: null | string = null;

    if (input?.currentRepo != null) {
      const repo = await db.repo.findFirst({
        select: { id: true },
        where: {
          name: input.currentRepo.name,
          owner: input.currentRepo.owner,
          workspaceId,
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

  async updateSession(db: DbClient, userId: string, input: UpdateSessionInput) {
    const session = await db.chatSession.update({
      data: { title: input.title },
      where: { id: input.sessionId, userId },
    });

    void realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.agentSessionUpdated, {});

    return session;
  },
};
