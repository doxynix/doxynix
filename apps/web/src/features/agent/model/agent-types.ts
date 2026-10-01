import type { RouterOutput } from "@/shared/api/trpc";

export type AgentSession = RouterOutput["agent"]["listSessions"][number];

export type LocalFileAttachment = {
  contentType: string;
  name: string;
  url: string;
};

// Closed union of only the shapes this UI pushes; the server stream is handled by useChat, not by this type.
export type AgentMessagePart =
  | { filename?: string; mediaType: string; type: "file"; url: string }
  | { text: string; type: "reasoning" }
  | { text: string; type: "text" };
