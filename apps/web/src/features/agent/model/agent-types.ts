import type { RouterOutput } from "@/shared/api/trpc";

/** One row of `trpc.agent.listSessions`. */
export type AgentSession = RouterOutput["agent"]["listSessions"][number];

/** A file the user attached before sending. */
export type LocalFileAttachment = {
  contentType: string;
  name: string;
  url: string;
};

/**
 * The `parts` entries this UI pushes. Deliberately a closed union of the
 * shapes the client itself constructs — the server stream is handled by
 * `useChat`, not by this type.
 */
export type AgentMessagePart =
  | { filename?: string; mediaType: string; type: "file"; url: string }
  | { text: string; type: "reasoning" }
  | { text: string; type: "text" };
