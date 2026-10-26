import type { ChatMessage } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { DbClient } from "@/server/core/db";

import { agentService } from "./agent.service";

const SESSION_ID = "018f0000-0000-7000-8000-0000000000bb";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";

const { publishMock } = vi.hoisted(() => ({ publishMock: vi.fn().mockResolvedValue(true) }));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: {
    user: () => ({ publish: publishMock }),
  },
}));

function stubDb(messages: ChatMessage[] = []) {
  const calls: unknown[] = [];

  const db = {
    chatMessage: {
      findMany(args: unknown) {
        calls.push(args);
        return Promise.resolve(messages);
      },
    },
    chatSession: {
      delete(args: unknown) {
        calls.push(args);
        return Promise.resolve({ id: SESSION_ID });
      },
      update(args: unknown) {
        calls.push(args);
        return Promise.resolve({ id: SESSION_ID, title: "Renamed chat" });
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

describe("agentService.updateSession", () => {
  it("scopes the rename to the calling user", async () => {
    const { calls, db } = stubDb();

    await agentService.updateSession(db, USER_ID, { sessionId: SESSION_ID, title: "Renamed chat" });

    expect(calls[0]).toStrictEqual({
      data: { title: "Renamed chat" },
      where: { id: SESSION_ID, userId: USER_ID },
    });
  });

  it("notifies the user channel so other sessions refresh the list", async () => {
    const { db } = stubDb();

    await agentService.updateSession(db, USER_ID, { sessionId: SESSION_ID, title: "Renamed chat" });

    expect(publishMock).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.agentSessionUpdated, {});
  });
});

describe("agentService.deleteSession", () => {
  it("scopes the delete to the calling user", async () => {
    const { calls, db } = stubDb();

    await agentService.deleteSession(db, USER_ID, { sessionId: SESSION_ID });

    expect(calls[0]).toStrictEqual({
      select: { id: true },
      where: { id: SESSION_ID, userId: USER_ID },
    });
  });

  it("notifies the user channel so other sessions refresh the list", async () => {
    const { db } = stubDb();

    await agentService.deleteSession(db, USER_ID, { sessionId: SESSION_ID });

    expect(publishMock).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.agentSessionUpdated, {});
  });
});
