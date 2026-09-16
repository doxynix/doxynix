import { ChatRole } from "@doxynix/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      chatMessage: { create: mocks.chatMessageCreate },
      chatSession: {
        create: mocks.chatSessionCreate,
        findUnique: mocks.chatSessionFindUnique,
      },
    }),
  ),
  chatMessageCreate: vi.fn(),
  chatSessionCreate: vi.fn(),
  chatSessionFindUnique: vi.fn(),
  chatSessionUpdate: vi.fn(),
  convertToModelMessages: vi.fn(async (messages: unknown) => messages),
  generateChatTitlePrompt: vi.fn((text: string) => `title prompt for: ${text}`),
  generateText: vi.fn(async () => ({ text: "Generated Title" })),
  getActiveModels: vi.fn(async () => ({
    AGENT: ["gemini-agent"],
    SENTINEL: ["gemini-sentinel"],
  })),
  getAgentTools: vi.fn(() => ({ listRepositories: {} })),
  getSession: vi.fn<() => Promise<{ user: { id: string; role: string } } | null>>(async () => ({
    user: { id: "7", role: "USER" },
  })),
  google: vi.fn((id: string) => ({ id })),
  headers: vi.fn(async () => ({})),
  logDebug: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  processMessageParts: vi.fn(async (parts: unknown) => parts),
  publish: vi.fn(),
  realtimeUser: vi.fn(() => ({ publish: mocks.publish })),
  repoFindUnique: vi.fn(),
  stepCountIs: vi.fn((n: number) => ({ __step: n })),
  streamText: vi.fn((_args: unknown) => ({
    toUIMessageStreamResponse: mocks.toUIMessageStreamResponse,
  })),
  toUIMessageStreamResponse: vi.fn((opts: unknown) => ({ opts })),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("ai", () => ({
  convertToModelMessages: mocks.convertToModelMessages,
  generateText: mocks.generateText,
  stepCountIs: mocks.stepCountIs,
  streamText: mocks.streamText,
}));
vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    debug: mocks.logDebug,
    error: mocks.logError,
    info: mocks.logInfo,
    warn: mocks.logWarn,
  },
}));
vi.mock("@/server/core/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/server/core/db", () => ({
  prisma: {
    $transaction: mocks.$transaction,
    chatMessage: { create: mocks.chatMessageCreate },
    chatSession: {
      create: mocks.chatSessionCreate,
      findUnique: mocks.chatSessionFindUnique,
      update: mocks.chatSessionUpdate,
    },
    repo: { findUnique: mocks.repoFindUnique },
  },
}));
vi.mock("@/server/core/google", () => ({ google: mocks.google }));
vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: mocks.realtimeUser },
}));
vi.mock("@/server/modules/agent/agent.prompts", () => ({
  AGENT_SYSTEM_PROMPT: "AGENT_SYSTEM_PROMPT_CONTENT",
  GENERATE_CHAT_TITLE_PROMPT: mocks.generateChatTitlePrompt,
}));
vi.mock("@/server/modules/agent/agent.tools", () => ({
  getAgentTools: mocks.getAgentTools,
}));
vi.mock("@/server/modules/agent/agent-storage", () => ({
  processMessageParts: mocks.processMessageParts,
}));
vi.mock("@/server/modules/analysis/ai/ai-constants", () => ({
  getActiveModels: mocks.getActiveModels,
}));

import { POST } from "./route";

const url = "http://localhost/api/agent/chat";

function post(body: unknown) {
  return POST(new Request(url, { body: JSON.stringify(body), method: "POST" }));
}

type StreamTextArgs = {
  messages?: unknown;
  model?: unknown;
  stopWhen?: unknown;
  system: string;
  tools?: unknown;
};

function lastStreamTextArgs(): StreamTextArgs {
  return (mocks.streamText.mock.calls.at(-1)?.[0] ?? {}) as StreamTextArgs;
}

beforeEach(() => {
  mocks.getActiveModels.mockResolvedValue({
    AGENT: ["gemini-agent"],
    SENTINEL: ["gemini-sentinel"],
  });
  mocks.getSession.mockResolvedValue({ user: { id: "7", role: "USER" } });
  mocks.repoFindUnique.mockResolvedValue(null);
  mocks.chatSessionFindUnique.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/agent/chat", () => {
  it("rejects when no AGENT model is configured", async () => {
    mocks.getActiveModels.mockResolvedValueOnce({
      AGENT: [],
      SENTINEL: ["gemini-sentinel"],
    });

    await expect(post({})).rejects.toThrow("No model configured for AGENT role");
  });

  it("resolves repo id from currentRepoId and builds a repo-scoped system prompt", async () => {
    mocks.repoFindUnique.mockResolvedValueOnce({ id: 5 });

    await post({ currentRepoId: "repo-pub", messages: [], sessionId: null });

    expect(mocks.repoFindUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: { publicId: "repo-pub" },
    });
    expect(mocks.getAgentTools).toHaveBeenCalledWith("repo-pub");
    expect(lastStreamTextArgs().system).toContain('Active Repository ID: "repo-pub"');
  });

  it("resolves repo from currentRepo owner/name for the signed-in user", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: "7", role: "USER" } });
    mocks.repoFindUnique.mockResolvedValueOnce({ id: 5, publicId: "r-pub" });

    await post({
      currentRepo: { name: "repo", owner: "acme" },
      messages: [],
      sessionId: null,
    });

    expect(mocks.repoFindUnique).toHaveBeenCalledWith({
      select: { id: true, publicId: true },
      where: {
        owner_name_userId: { name: "repo", owner: "acme", userId: 7 },
      },
    });
    expect(mocks.getAgentTools).toHaveBeenCalledWith("r-pub");
  });

  it("falls back to the global dashboard prompt when no repository context exists", async () => {
    await post({});

    expect(mocks.repoFindUnique).not.toHaveBeenCalled();
    expect(mocks.getAgentTools).toHaveBeenCalledWith(undefined);
    expect(lastStreamTextArgs().system).toContain("GLOBAL DASHBOARD");
    expect(lastStreamTextArgs().system).toContain("listRepositories");
  });

  it("creates a new session and persists the user message inside $transaction", async () => {
    const parts = [{ text: "hello", type: "text" }];
    const messages = [{ parts, role: "user" }];
    mocks.repoFindUnique.mockResolvedValueOnce({ id: 5 });

    await post({ currentRepoId: "r", messages, sessionId: "s-1" });

    expect(mocks.processMessageParts).toHaveBeenCalledWith(parts);
    expect(mocks.chatSessionCreate).toHaveBeenCalledWith({
      data: { id: "s-1", repoId: 5, title: "New Chat", userId: 7 },
    });
    expect(mocks.chatMessageCreate).toHaveBeenCalledWith({
      data: {
        parts: JSON.stringify(parts),
        role: ChatRole.user,
        sessionId: "s-1",
      },
    });
  });

  it("does not persist anything when sessionId is null", async () => {
    await post({ messages: [{ parts: [], role: "user" }] });

    expect(mocks.$transaction).not.toHaveBeenCalled();
  });

  it("calls streamText with the resolved model and returns the UIMessageStreamResponse", async () => {
    const messages = [{ parts: [{ text: "hi", type: "text" }], role: "user" }];

    const res = await post({ messages });

    expect(mocks.google).toHaveBeenCalledWith("gemini-agent");
    expect(mocks.streamText).toHaveBeenCalledWith({
      messages,
      model: { id: "gemini-agent" },
      stopWhen: { __step: 10 },
      system: expect.stringContaining("AGENT_SYSTEM_PROMPT_CONTENT"),
      tools: expect.any(Object),
    });
    expect(mocks.toUIMessageStreamResponse).toHaveBeenCalledWith({
      onFinish: expect.any(Function),
      originalMessages: messages,
    });
    expect(res).toEqual({
      opts: expect.objectContaining({
        onFinish: expect.any(Function),
        originalMessages: messages,
      }),
    });
  });

  it("skips session creation when no user is authenticated", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    mocks.repoFindUnique.mockResolvedValueOnce({ id: 5 });
    const messages = [{ parts: [{ text: "hi", type: "text" }], role: "user" }];

    await post({ currentRepoId: "repo-pub", messages, sessionId: "s-1" });

    expect(mocks.repoFindUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: { publicId: "repo-pub" },
    });
    expect(mocks.$transaction).toHaveBeenCalled();
    expect(mocks.chatSessionCreate).not.toHaveBeenCalled();
    expect(mocks.chatMessageCreate).toHaveBeenCalled();
  });
});
