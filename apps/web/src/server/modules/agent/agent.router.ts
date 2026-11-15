import { ChatRoleSchema, CursorMetaSchema, MAX_PAGE_SIZE } from "@doxynix/shared";
import * as z from "zod";

import { createTRPCRouter, protectedProcedure, workspaceProcedure } from "@/server/core/trpc/init";
import { CursorSchema } from "@/server/utils/pagination";

import type { SessionMessagePart } from "./agent.mapper";
import { agentService } from "./agent.service";

const SessionMessageSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  parts: z.array(z.custom<SessionMessagePart>()),
  role: ChatRoleSchema,
});

const SessionHistoryOutput = z.object({
  items: z.array(SessionMessageSchema),
  meta: CursorMetaSchema,
});

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

const ListSessionsOutput = z.object({
  items: z.array(SessionListItemSchema),
  meta: CursorMetaSchema,
});

const SessionHistoryInput = CursorSchema.omit({ search: true }).extend({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(100),
  sessionId: z.uuid(),
});

const ListSessionsInput = CursorSchema.omit({ search: true }).extend({
  currentRepo: z
    .object({
      name: z.string(),
      owner: z.string(),
    })
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

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
  createSession: workspaceProcedure
    .input(
      z.object({
        repoId: z.uuid().optional().describe("Public repo UUID, if chat in project"),
        title: z.string().default("New Chat"),
      }),
    )
    .output(CreateSessionOutput)
    .mutation(async ({ ctx, input }) => {
      return agentService.createSession(ctx.db, ctx.session.user.id, ctx.workspace.id, input);
    }),

  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      return agentService.deleteSession(ctx.db, ctx.session.user.id, input);
    }),

  getSessionHistory: protectedProcedure
    .input(SessionHistoryInput)
    .output(SessionHistoryOutput)
    .query(async ({ ctx, input }) => {
      return agentService.getSessionHistory(ctx.db, ctx.session.user.id, input);
    }),

  listSessions: workspaceProcedure
    .input(ListSessionsInput)
    .output(ListSessionsOutput)
    .query(async ({ ctx, input }) => {
      return agentService.listSessions(ctx.db, ctx.session.user.id, ctx.workspace.id, input);
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
