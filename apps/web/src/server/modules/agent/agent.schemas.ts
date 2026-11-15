import { ChatRoleSchema, CursorMetaSchema, MAX_PAGE_SIZE } from "@doxynix/shared";
import * as z from "zod";

import { CursorSchema } from "@/server/utils/pagination";

import type { SessionMessage, SessionMessagePart } from "./agent.mapper";

export const SessionMessageSchema: z.ZodType<SessionMessage> = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  parts: z.array(z.custom<SessionMessagePart>()),
  role: ChatRoleSchema,
});

export const SessionHistoryOutputSchema = z.object({
  items: z.array(SessionMessageSchema),
  meta: CursorMetaSchema,
});

export type SessionHistoryOutput = z.infer<typeof SessionHistoryOutputSchema>;

export const SessionListItemSchema = z.object({
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

export type SessionListItem = z.infer<typeof SessionListItemSchema>;

export const ListSessionsOutputSchema = z.object({
  items: z.array(SessionListItemSchema),
  meta: CursorMetaSchema,
});

export type ListSessionsOutput = z.infer<typeof ListSessionsOutputSchema>;

export const SessionHistoryInputSchema = CursorSchema.omit({ search: true }).extend({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(100),
  sessionId: z.uuid(),
});

export type SessionHistoryInput = z.infer<typeof SessionHistoryInputSchema>;

export const ListSessionsInputSchema = CursorSchema.omit({ search: true }).extend({
  currentRepo: z
    .object({
      name: z.string(),
      owner: z.string(),
    })
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

export type ListSessionsInput = z.infer<typeof ListSessionsInputSchema>;

export const CreateSessionInputSchema = z.object({
  repoId: z.uuid().optional().describe("Public repo UUID, if chat in project"),
  title: z.string().default("New Chat"),
});

export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

export const CreateSessionOutputSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  title: z.string(),
  updatedAt: z.date(),
});

export type CreateSessionOutput = z.infer<typeof CreateSessionOutputSchema>;

export const DeleteSessionInputSchema = z.object({ sessionId: z.uuid() });

export type DeleteSessionInput = z.infer<typeof DeleteSessionInputSchema>;

export const UpdateSessionInputSchema = z.object({
  sessionId: z.uuid(),
  title: z.string().trim().min(1).max(200),
});

export type UpdateSessionInput = z.infer<typeof UpdateSessionInputSchema>;

export const UpdateSessionOutputSchema = z.object({
  id: z.uuid(),
  title: z.string(),
});

export type UpdateSessionOutput = z.infer<typeof UpdateSessionOutputSchema>;
