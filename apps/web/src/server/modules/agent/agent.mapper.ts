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
      // `Array.isArray` narrows the `any` that `JSON.parse` returns, so a row
      // whose `parts` column holds an object or a scalar no longer flows on as
      // an unchecked message-parts array. The element cast is irreducible:
      // `SessionMessagePart` is the AI SDK's `UIMessagePart` union, and a schema
      // here would duplicate the SDK's contract and break on every upgrade.
      const parsed: unknown = JSON.parse(message.parts);
      parts = Array.isArray(parsed) ? (parsed as SessionMessagePart[]) : [];
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
