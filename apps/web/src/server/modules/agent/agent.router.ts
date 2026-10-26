import * as z from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/core/trpc/init";

import { agentService } from "./agent.service";

const SessionListItemSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  repo: z
    .object({
      name: z.string(),
      owner: z.string(),
    })
    .nullable(),
  title: z.string(),
  updatedAt: z.date(),
});

const ListSessionsOutput = z.array(SessionListItemSchema);

const CreateSessionOutput = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  title: z.string(),
  updatedAt: z.date(),
});

const UpdateSessionOutput = z.object({
  id: z.uuid(),
  title: z.string(),
});

export const agentChatRouter = createTRPCRouter({
  createSession: protectedProcedure
    .input(
      z.object({
        repoId: z.uuid().optional().describe("Public repo UUID, if chat in project"),
        title: z.string().default("New Chat"),
      }),
    )
    .output(CreateSessionOutput)
    .mutation(async ({ ctx, input }) => {
      return agentService.createSession(ctx.db, ctx.session.user.id, input);
    }),

  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      return agentService.deleteSession(ctx.db, ctx.session.user.id, input);
    }),

  getSessionHistory: protectedProcedure
    .input(z.object({ sessionId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return agentService.getSessionHistory(ctx.db, ctx.session.user.id, input.sessionId);
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
    .output(ListSessionsOutput)
    .query(async ({ ctx, input }) => {
      return agentService.listSessions(ctx.db, ctx.session.user.id, input);
    }),

  updateSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.uuid(),
        title: z.string().trim().min(1).max(200),
      }),
    )
    .output(UpdateSessionOutput)
    .mutation(async ({ ctx, input }) => {
      const session = await agentService.updateSession(ctx.db, ctx.session.user.id, input);

      return { id: session.id, title: session.title };
    }),
});
