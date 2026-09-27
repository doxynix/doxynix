import * as z from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { agentService } from "./agent.service";

export const agentChatRouter = createTRPCRouter({
  createSession: protectedProcedure
    .input(
      z.object({
        repoId: z.uuid().optional().describe("Public repo UUID, if chat in project"),
        title: z.string().default("New Chat"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return agentService.createSession(ctx.db, Number(ctx.session.user.id), input);
    }),

  getSessionHistory: protectedProcedure
    .input(z.object({ sessionId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return agentService.getSessionHistory(ctx.db, Number(ctx.session.user.id), input.sessionId);
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
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return agentService.listSessions(ctx.db, Number(ctx.session.user.id), input);
    }),
});
