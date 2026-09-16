import { ChatRole } from "@doxynix/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

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

type ModelMessage = {
  role: string;
  parts?: Array<{ type: string; text?: string }>;
};

type OnFinishArgs = {
  messages: ModelMessage[];
  responseMessage: { parts: Array<{ type: string; text?: string }> };
};

type OnFinish = (args: OnFinishArgs) => Promise<void>;

function post(body: unknown) {
  return POST(new Request(url, { body: JSON.stringify(body), method: "POST" }));
}

async function captureOnFinish(body: unknown): Promise<OnFinish> {
  await post(body);
  const opts = (mocks.toUIMessageStreamResponse.mock.calls.at(-1)?.[0] ?? {}) as {
    onFinish: OnFinish;
  };
  return opts.onFinish;
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

describe("POST /api/agent/chat onFinish", () => {
  it("persists the assistant message and generates + publishes a title", async () => {
    const onFinish = await captureOnFinish({ messages: [], sessionId: "s-1" });
    mocks.chatSessionFindUnique.mockResolvedValueOnce({ title: "New Chat" });

    await onFinish({
      messages: [{ parts: [{ text: "Hello world", type: "text" }], role: "user" }],
      responseMessage: { parts: [{ text: "Reply", type: "text" }] },
    });

    expect(mocks.chatMessageCreate).toHaveBeenCalledWith({
      data: {
        parts: JSON.stringify([{ text: "Reply", type: "text" }]),
        role: ChatRole.assistant,
        sessionId: "s-1",
      },
    });
    expect(mocks.google).toHaveBeenCalledWith("gemini-sentinel");
    expect(mocks.generateText).toHaveBeenCalledWith({
      model: { id: "gemini-sentinel" },
      prompt: "title prompt for: Hello world",
      temperature: 0.1,
    });
    expect(mocks.chatSessionUpdate).toHaveBeenCalledWith({
      data: { title: "Generated Title" },
      where: { id: "s-1" },
    });
    expect(mocks.publish).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.sessionUpdated, {
      sessionId: "s-1",
      title: "Generated Title",
    });
  });

  it("skips title generation when the session title is not 'New Chat'", async () => {
    const onFinish = await captureOnFinish({ messages: [], sessionId: "s-1" });
    mocks.chatSessionFindUnique.mockResolvedValueOnce({ title: "Existing" });

    await onFinish({
      messages: [{ parts: [{ text: "Hello world", type: "text" }], role: "user" }],
      responseMessage: { parts: [{ text: "Reply", type: "text" }] },
    });

    expect(mocks.chatMessageCreate).toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("skips title generation when the first user text is empty", async () => {
    const onFinish = await captureOnFinish({ messages: [], sessionId: "s-1" });
    mocks.chatSessionFindUnique.mockResolvedValueOnce({ title: "New Chat" });

    await onFinish({
      messages: [{ parts: [{ text: "   ", type: "text" }], role: "user" }],
      responseMessage: { parts: [{ text: "Reply", type: "text" }] },
    });

    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("swallows title-generation errors and logs them", async () => {
    const onFinish = await captureOnFinish({ messages: [], sessionId: "s-1" });
    mocks.chatSessionFindUnique.mockResolvedValueOnce({ title: "New Chat" });
    mocks.chatSessionUpdate.mockRejectedValueOnce(new Error("update failed"));

    await expect(
      onFinish({
        messages: [{ parts: [{ text: "Hello world", type: "text" }], role: "user" }],
        responseMessage: { parts: [{ text: "Reply", type: "text" }] },
      }),
    ).resolves.toBeUndefined();

    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Async chat title generation failed in onFinish:",
      }),
    );
  });

  it("does not persist when sessionId is null", async () => {
    const onFinish = await captureOnFinish({ messages: [] });

    await onFinish({
      messages: [{ parts: [{ text: "Hello world", type: "text" }], role: "user" }],
      responseMessage: { parts: [{ text: "Reply", type: "text" }] },
    });

    expect(mocks.chatMessageCreate).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
