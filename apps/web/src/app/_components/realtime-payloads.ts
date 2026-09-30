import * as z from "zod/mini";

// Ably types data as any, so these parse instead of asserting; they live here (not in the client provider) so node tests can import them, and are keyed by REALTIME_CONFIG.events.user.*.
export const RealtimeUserPayloads = {
  "analysis-progress": z.object({
    analysisId: z.string(),
    message: z.string(),
    progress: z.number(),
    status: z.enum(["DONE", "FAILED", "NEW", "PENDING"]),
  }),
  fileActionCompleted: z.object({
    fixId: z.optional(z.string()),
    path: z.optional(z.string()),
    type: z.enum(["AUDIT", "DOCUMENTATION", "FIX_GENERATED"]),
  }),
  notification: z.object({
    body: z.string(),
    title: z.string(),
  }),
  "pr-comment-received": z.object({
    author: z.string(),
    authorAvatarUrl: z.string(),
    commentId: z.string(),
    prNumber: z.number(),
    prTitle: z.string(),
    repoName: z.string(),
    repoOwner: z.string(),
  }),
} as const;

export type RealtimeUserEvent = keyof typeof RealtimeUserPayloads;

// Returns null on mismatch so an unexpected payload is dropped instead of rendering undefined fields, and the type needs no assertion.
export function parseRealtimePayload<T>(schema: z.ZodMiniType<T>, data: unknown): null | T {
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
