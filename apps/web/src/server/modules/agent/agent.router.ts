import { createTRPCRouter, protectedProcedure, workspaceProcedure } from "@/server/core/trpc/init";

import {
  CreateSessionInputSchema,
  CreateSessionOutputSchema,
  DeleteSessionInputSchema,
  ListSessionsInputSchema,
  ListSessionsOutputSchema,
  SessionHistoryInputSchema,
  SessionHistoryOutputSchema,
  UpdateSessionInputSchema,
  UpdateSessionOutputSchema,
} from "./agent.schemas";
import { agentService } from "./agent.service";

export const agentChatRouter = createTRPCRouter({
  createSession: workspaceProcedure
    .input(CreateSessionInputSchema)
    .output(CreateSessionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      return agentService.createSession(ctx.db, ctx.session.user.id, ctx.workspace.id, input);
    }),

  deleteSession: protectedProcedure
    .input(DeleteSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return agentService.deleteSession(ctx.db, ctx.session.user.id, input);
    }),

  getSessionHistory: protectedProcedure
    .input(SessionHistoryInputSchema)
    .output(SessionHistoryOutputSchema)
    .query(async ({ ctx, input }) => {
      return agentService.getSessionHistory(ctx.db, ctx.session.user.id, input);
    }),

  listSessions: workspaceProcedure
    .input(ListSessionsInputSchema)
    .output(ListSessionsOutputSchema)
    .query(async ({ ctx, input }) => {
      return agentService.listSessions(ctx.db, ctx.session.user.id, ctx.workspace.id, input);
    }),

  updateSession: protectedProcedure
    .input(UpdateSessionInputSchema)
    .output(UpdateSessionOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const session = await agentService.updateSession(ctx.db, ctx.session.user.id, input);

      return { id: session.id, title: session.title };
    }),
});
