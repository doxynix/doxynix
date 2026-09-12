import type { RouterInput, RouterOutput } from "@/core/client";

export type ChatSessionItem = RouterOutput["agent"]["listSessions"][number];
export type ChatMessageHistoryItem = RouterOutput["agent"]["getSessionHistory"][number];
export type CreateSessionInput = RouterInput["agent"]["createSession"];
export type ListSessionsInput = RouterInput["agent"]["listSessions"];
export type GetSessionHistoryInput = RouterInput["agent"]["getSessionHistory"];

export type UIMessageTextPart = {
  text: string;
  type: "text";
};

export type UIMessageToolPart = {
  approval?: {
    approved: boolean;
    id: string;
    reason?: string;
  };
  args: Record<string, unknown>;
  output?: unknown;
  state:
    | "approval-requested"
    | "approval-responded"
    | "input-available"
    | "output-available"
    | "output-error";
  toolCallId: string;
  toolName: string;
  type: string;
};

export type UIMessagePart = UIMessageTextPart | UIMessageToolPart;

export type UIMessage = {
  id: string;
  parts: UIMessagePart[];
  role: "assistant" | "system" | "user";
};

export type PendingApproval = {
  approvalId: string;
  input: Record<string, unknown>;
  toolCallId: string;
  toolName: string;
};
