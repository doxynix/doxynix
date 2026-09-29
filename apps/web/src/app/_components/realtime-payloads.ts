import * as z from "zod/mini";

/**
 * Payload shapes for the Ably events the client subscribes to.
 *
 * Ably types `InboundMessage.data` as `any`, so these were previously read with
 * a blind assertion and a malformed message rendered `undefined` into the UI.
 * They live here rather than in the provider component so they can be tested:
 * `realtime-provider.tsx` is a client component and cannot be imported by a
 * node-environment test.
 *
 * The keys are the `REALTIME_CONFIG.events.user.*` values, since the provider
 * indexes this record by them.
 */
export const RealtimeUserPayloads = {
  "analysis-progress": z.object({
    analysisId: z.string(),
    message: z.string(),
    progress: z.number(),
    // Mirrors the generated `Status` enum. Not imported from `@doxynix/shared`
    // because that module is built on `zod/mini`'s full build and pulling it
    // into the client bundle is not worth the coupling.
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

/**
 * Parses a payload against its schema. Returns `null` when the message does not
 * match, so an unexpected payload is dropped rather than rendered with
 * `undefined` fields. The result type is inferred from the schema, so no call
 * site needs an assertion.
 */
export function parseRealtimePayload<T>(schema: z.ZodMiniType<T>, data: unknown): null | T {
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
