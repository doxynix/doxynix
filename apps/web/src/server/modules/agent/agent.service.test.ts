import type { ChatMessage } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { DbClient } from "@/server/core/db";

import { agentService } from "./agent.service";

const SESSION_ID = "018f0000-0000-7000-8000-0000000000bb";
const USER_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";

const { publishMock } = vi.hoisted(() => ({ publishMock: vi.fn().mockResolvedValue(true) }));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: {
    user: () => ({ publish: publishMock }),
  },
}));

function stubDb(
  messages: ChatMessage[] = [],
  sessions: unknown[] = [],
  repo: unknown = { id: REPO_ID },
) {
  const calls: unknown[] = [];
  const sessionListCalls: unknown[] = [];

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
      findMany(args: unknown) {
        sessionListCalls.push(args);
        return Promise.resolve(sessions);
      },
      update(args: unknown) {
        calls.push(args);
        return Promise.resolve({ id: SESSION_ID, title: "Renamed chat" });
      },
    },
    repo: {
      findFirst() {
        return Promise.resolve(repo);
      },
    },
  } as unknown as DbClient;

  return { calls, db, sessionListCalls };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    createdAt: new Date("2026-03-01T12:00:00Z"),
    id: "018f0000-0000-7000-8000-0000000000a1",
    parts: JSON.stringify([{ text: "hello", type: "text" }]),
    role: "user",
    sessionId: SESSION_ID,
    ...overrides,
  };
}

describe("agentService.getSessionHistory", () => {
  it("scopes the query to the calling user as well as the session", async () => {
    const { calls, db } = stubDb([makeMessage()]);

    const history = await agentService.getSessionHistory(db, USER_ID, {
      limit: 100,
      sessionId: SESSION_ID,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toStrictEqual({
      cursor: undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { createdAt: true, id: true, parts: true, role: true },
      take: 101,
      where: { session: { userId: USER_ID }, sessionId: SESSION_ID },
    });
    expect(history.items).toHaveLength(1);
  });

  it("never issues an unscoped sessionId-only lookup", async () => {
    const { calls, db } = stubDb();

    await agentService.getSessionHistory(db, USER_ID, { limit: 100, sessionId: SESSION_ID });

    const where = (calls[0] as { where: Record<string, unknown> }).where;
    expect(where).toHaveProperty("session");
    expect(where).not.toStrictEqual({ sessionId: SESSION_ID });
  });

  it("takes the newest page and hands it back in chronological order", async () => {
    const older = makeMessage({
      createdAt: new Date("2026-03-01T12:00:00Z"),
      id: "018f0000-0000-7000-8000-0000000000a1",
    });
    const newer = makeMessage({
      createdAt: new Date("2026-03-01T12:05:00Z"),
      id: "018f0000-0000-7000-8000-0000000000a2",
    });
    const { db } = stubDb([newer, older]);

    const history = await agentService.getSessionHistory(db, USER_ID, {
      limit: 100,
      sessionId: SESSION_ID,
    });

    expect(history.items.map((message) => message.id)).toStrictEqual([older.id, newer.id]);
    expect(history.meta).toStrictEqual({ hasNextPage: false, nextCursor: undefined });
  });

  it("passes an older-page cursor through as a row id", async () => {
    const cursor = "018f0000-0000-7000-8000-0000000000a1";
    const { calls, db } = stubDb();

    await agentService.getSessionHistory(db, USER_ID, { cursor, limit: 2, sessionId: SESSION_ID });

    expect(calls[0]).toStrictEqual({
      cursor: { id: cursor },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { createdAt: true, id: true, parts: true, role: true },
      take: 3,
      where: { session: { userId: USER_ID }, sessionId: SESSION_ID },
    });
  });

  it("turns the extra probe row into the next cursor", async () => {
    const newest = makeMessage({
      createdAt: new Date("2026-03-01T12:03:00Z"),
      id: "018f0000-0000-7000-8000-0000000000b0",
    });
    const older = makeMessage({
      createdAt: new Date("2026-03-01T12:02:00Z"),
      id: "018f0000-0000-7000-8000-0000000000b1",
    });
    const probe = makeMessage({
      createdAt: new Date("2026-03-01T12:01:00Z"),
      id: "018f0000-0000-7000-8000-0000000000b2",
    });
    const { db } = stubDb([newest, older, probe]);

    const history = await agentService.getSessionHistory(db, USER_ID, {
      limit: 2,
      sessionId: SESSION_ID,
    });

    expect(history.items).toHaveLength(2);
    expect(history.items.map((message) => message.id)).toStrictEqual([older.id, newest.id]);
    expect(history.meta).toStrictEqual({ hasNextPage: true, nextCursor: probe.id });
  });
});

describe("agentService.listSessions", () => {
  it("keysets on updatedAt and selects only the fields the router returns", async () => {
    const { db, sessionListCalls } = stubDb();

    await agentService.listSessions(db, USER_ID, "ws-1", { limit: 50 });

    expect(sessionListCalls).toHaveLength(1);
    expect(sessionListCalls[0]).toStrictEqual({
      cursor: undefined,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        createdAt: true,
        id: true,
        repo: { select: { name: true, owner: true } },
        repoId: true,
        title: true,
        updatedAt: true,
      },
      take: 51,
      where: { repoId: null, userId: USER_ID },
    });
  });

  it("keeps the currentRepo filter and pages older sessions by cursor", async () => {
    const cursor = "018f0000-0000-7000-8000-0000000000c1";
    const { db, sessionListCalls } = stubDb([], [], { id: REPO_ID });

    const page = await agentService.listSessions(db, USER_ID, "ws-1", {
      currentRepo: { name: "repo", owner: "owner" },
      cursor,
      limit: 50,
    });

    expect(sessionListCalls[0]).toMatchObject({
      cursor: { id: cursor },
      take: 51,
      where: { repoId: REPO_ID, userId: USER_ID },
    });
    expect(page.meta).toStrictEqual({ hasNextPage: false, nextCursor: undefined });
  });

  it("flips hasNextPage when the probe row comes back", async () => {
    const newest = {
      createdAt: new Date("2026-03-01T12:00:00Z"),
      id: "018f0000-0000-7000-8000-0000000000e0",
      repo: null,
      repoId: null,
      title: "Chat 0",
      updatedAt: new Date("2026-03-01T12:02:00Z"),
    };
    const older = { ...newest, id: "018f0000-0000-7000-8000-0000000000e1", title: "Chat 1" };
    const { db } = stubDb([], [newest, older]);

    const page = await agentService.listSessions(db, USER_ID, "ws-1", { limit: 1 });

    expect(page.items.map((session) => session.id)).toStrictEqual([newest.id]);
    expect(page.meta).toStrictEqual({ hasNextPage: true, nextCursor: older.id });
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
