import type { ChatMessage } from "@prisma/client";
import type { UIDataTypes, UIMessagePart, UITools } from "ai";

import { appLogger } from "@/server/core/app-logger";

type SessionMessagePart = UIMessagePart<UIDataTypes, UITools>;

export type SessionMessage = {
  createdAt: Date;
  id: string;
  parts: SessionMessagePart[];
  role: ChatMessage["role"];
};

export const agentMapper = {
  toSessionMessage(message: ChatMessage): SessionMessage {
    let parts: SessionMessagePart[];

    try {
      parts = JSON.parse(message.parts) as SessionMessagePart[];
    } catch (error) {
      appLogger.warn({
        error: error instanceof Error ? error.message : String(error),
        id: message.id,
        msg: "Unparseable chat message parts",
      });

      parts = [];
    }

    return {
      createdAt: message.createdAt,
      id: message.id,
      parts,
      role: message.role,
    };
  },
};
