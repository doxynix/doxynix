import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatMessageCreate: vi.fn(),
  chatSessionCreate: vi.fn(),
  chatSessionFindUnique: vi.fn(),
  chatSessionUpdate: vi.fn(),
  generateText: vi.fn(),
  getActiveModels: vi.fn(),
  getWorkspaceEntitlement: vi.fn(),
  processMessageParts: vi.fn(),
  publish: vi.fn(),
  releaseUsage: vi.fn(),
  reserveUsage: vi.fn(),
  resolveRequestUserId: vi.fn(),
  resolveWorkspace: vi.fn(),
  settleUsage: vi.fn(),
  toUIMessageStream: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-workspace-id": "ws-1" }),
}));

vi.mock("@/server/core/db", () => {
  const tx = {
    $executeRaw: vi.fn(),
    chatMessage: { create: mocks.chatMessageCreate },
    chatSession: { create: mocks.chatSessionCreate, findUnique: mocks.chatSessionFindUnique },
  };

  return {
    prisma: {
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      chatMessage: { create: mocks.chatMessageCreate },
      chatSession: { findUnique: mocks.chatSessionFindUnique, update: mocks.chatSessionUpdate },
      repo: { findFirst: vi.fn(), findUnique: vi.fn() },
    },
  };
});

vi.mock("ai", () => ({
  convertToModelMessages: async () => [],
  createUIMessageStreamResponse: () => new Response("stream"),
  generateText: mocks.generateText,
  isStepCount: () => false,
  streamText: () => ({ stream: {} }),
  toUIMessageStream: mocks.toUIMessageStream,
}));

vi.mock("@/server/core/ai/ai-constants", () => ({ getActiveModels: mocks.getActiveModels }));
vi.mock("@/server/core/ai/google", () => ({ google: () => "google/model" }));
vi.mock("@/server/core/app-logger", () => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/server/core/auth/resolve-session", () => ({
  resolveRequestUserId: mocks.resolveRequestUserId,
}));
vi.mock("@/server/core/entitlements", () => ({
  getWorkspaceEntitlement: mocks.getWorkspaceEntitlement,
}));
vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: () => ({ publish: mocks.publish }) },
}));
vi.mock("@/server/core/usage/usage", () => ({
  releaseUsage: mocks.releaseUsage,
  reserveUsage: mocks.reserveUsage,
  settleUsage: mocks.settleUsage,
}));
vi.mock("@/server/core/workspaces/resolve-workspace", () => ({
  resolveWorkspace: mocks.resolveWorkspace,
}));
vi.mock("@/server/modules/agent/agent-storage", () => ({
  processMessageParts: mocks.processMessageParts,
}));
vi.mock("@/server/modules/agent/agent.tools", () => ({
  getAgentTools: () => ({}),
  MUTATION_TOOLS: [],
}));
vi.mock("@/server/utils/with-api-handler", () => ({
  withApiHandler: (handler: unknown) => handler,
}));

import { POST } from "./route";

const SESSION_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d";
const USER_ID = "user-1";

const messages = [
  { id: "msg-1", parts: [{ text: "Why is the login button broken?", type: "text" }], role: "user" },
];

let onEnd:
  | ((args: { messages: unknown[]; responseMessage: { parts: unknown[] } }) => Promise<void>)
  | undefined;

async function runChat() {
  const request = new Request("http://localhost/api/agent/chat", {
    body: JSON.stringify({ messages, sessionId: SESSION_ID }),
    method: "POST",
  });

  await POST(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  onEnd = undefined;

  mocks.getActiveModels.mockResolvedValue({ AGENT: ["gemini-3-pro"], SENTINEL: ["gemini-flash"] });
  mocks.getWorkspaceEntitlement.mockResolvedValue({ aiTokensPerMonth: null, hasAccess: true });
  mocks.processMessageParts.mockImplementation(async (parts: unknown) => parts);
  mocks.resolveRequestUserId.mockResolvedValue(USER_ID);
  mocks.resolveWorkspace.mockResolvedValue({ id: "ws-1" });
  mocks.toUIMessageStream.mockImplementation((args: { onEnd: typeof onEnd }) => {
    onEnd = args.onEnd;
    return {};
  });
});

describe("POST /api/agent/chat", () => {
  it("generates the title from the flag the existence probe carried, without re-reading the session", async () => {
    mocks.chatSessionFindUnique.mockResolvedValue(null);
    mocks.generateText.mockResolvedValue({ text: '"Broken login button"' });

    await runChat();
    await onEnd?.({ messages, responseMessage: { parts: [] } });

    expect(mocks.chatSessionFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.chatSessionFindUnique).toHaveBeenCalledWith({
      select: { id: true, title: true },
      where: { id: SESSION_ID, userId: USER_ID },
    });
    expect(mocks.chatSessionCreate).toHaveBeenCalledWith({
      data: { id: SESSION_ID, repoId: null, title: "New Chat", userId: USER_ID },
    });
    expect(mocks.generateText).toHaveBeenCalledTimes(1);
    expect(mocks.chatSessionUpdate).toHaveBeenCalledWith({
      data: { title: "Broken login button" },
      where: { id: SESSION_ID, userId: USER_ID },
    });
    expect(mocks.publish).toHaveBeenCalledWith(expect.anything(), {
      sessionId: SESSION_ID,
      title: "Broken login button",
    });
  });

  it("keeps the generated title when the session already has one", async () => {
    mocks.chatSessionFindUnique.mockResolvedValue({ id: SESSION_ID, title: "Named by the user" });

    await runChat();
    await onEnd?.({ messages, responseMessage: { parts: [] } });

    expect(mocks.chatSessionCreate).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(mocks.chatSessionUpdate).not.toHaveBeenCalled();
  });

  it("skips the session probe and the title when the request carries no session", async () => {
    await POST(
      new Request("http://localhost/api/agent/chat", {
        body: JSON.stringify({ messages }),
        method: "POST",
      }),
    );
    await onEnd?.({ messages, responseMessage: { parts: [] } });

    expect(mocks.chatSessionFindUnique).not.toHaveBeenCalled();
    expect(mocks.chatMessageCreate).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
