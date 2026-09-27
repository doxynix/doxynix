import type { ChatMessage } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { DbClient } from "@/server/core/db";

import { agentService } from "./agent.service";

const SESSION_ID = "018f0000-0000-7000-8000-0000000000bb";
const USER_ID = 42;

function stubDb(messages: ChatMessage[] = []) {
  const calls: unknown[] = [];

  const db = {
    chatMessage: {
      findMany(args: unknown) {
        calls.push(args);
        return Promise.resolve(messages);
      },
    },
  } as unknown as DbClient;

  return { calls, db };
}

function makeMessage(): ChatMessage {
  return {
    createdAt: new Date("2026-03-01T12:00:00Z"),
    id: "018f0000-0000-7000-8000-0000000000a1",
    parts: JSON.stringify([{ text: "hello", type: "text" }]),
    role: "user",
    sessionId: SESSION_ID,
  };
}

describe("agentService.getSessionHistory", () => {
  it("scopes the query to the calling user as well as the session", async () => {
    const { calls, db } = stubDb([makeMessage()]);

    const history = await agentService.getSessionHistory(db, USER_ID, SESSION_ID);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toStrictEqual({
      orderBy: { createdAt: "asc" },
      where: { session: { userId: USER_ID }, sessionId: SESSION_ID },
    });
    expect(history).toHaveLength(1);
  });

  it("never issues an unscoped sessionId-only lookup", async () => {
    const { calls, db } = stubDb();

    await agentService.getSessionHistory(db, USER_ID, SESSION_ID);

    const where = (calls[0] as { where: Record<string, unknown> }).where;
    expect(where).toHaveProperty("session");
    expect(where).not.toStrictEqual({ sessionId: SESSION_ID });
  });
});
