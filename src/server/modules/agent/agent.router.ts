import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

export const agentChatRouter = createTRPCRouter({
  createSession: protectedProcedure
    .input(
      z.object({
        repoId: z.uuid().optional().describe("Public repo UUID, if chat in project"),
        title: z.string().default("New Chat"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);
      let internalRepoId: number | undefined;

      if (input.repoId != null) {
        const repo = await ctx.db.repo.findFirst({
          select: { id: true },
          where: {
            publicId: input.repoId,
            userId,
          },
        });

        if (repo == null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Repository not found or access denied",
          });
        }

        internalRepoId = repo.id;
      }

      return ctx.db.chatSession.create({
        data: {
          repoId: internalRepoId,
          title: input.title,
          userId,
        },
      });
    }),

  getSessionHistory: protectedProcedure
    .input(z.object({ sessionId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const rawMessages = await ctx.db.chatMessage.findMany({
        orderBy: { createdAt: "asc" },
        where: { sessionId: input.sessionId },
      });

      return rawMessages.map((msg) => ({
        createdAt: msg.createdAt,
        id: msg.id,
        parts: JSON.parse(msg.parts),
        role: msg.role,
      }));
    }),

  listSessions: protectedProcedure
    .input(
      z
        .object({
          currentRepo: z
            .object({
              name: z.string(),
              owner: z.string(),
            })
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = Number(ctx.session.user.id);
      let internalRepoId: null | number = null;

      if (input?.currentRepo != null) {
        const repo = await ctx.db.repo.findUnique({
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

      return ctx.db.chatSession.findMany({
        include: {
          repo: {
            select: {
              name: true,
              owner: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        where: {
          repoId: internalRepoId,
          userId,
        },
      });
    }),
});
