import type { RouterInput, RouterOutput } from "@/core/client";

export type ChatSessionItem = RouterOutput["agent"]["listSessions"][number];
export type ChatMessageHistoryItem = RouterOutput["agent"]["getSessionHistory"][number];
export type CreateSessionInput = RouterInput["agent"]["createSession"];
export type ListSessionsInput = RouterInput["agent"]["listSessions"];
export type GetSessionHistoryInput = RouterInput["agent"]["getSessionHistory"];

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type PendingToolCall = {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  hasExecutedOnServer: boolean;
};
