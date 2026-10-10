import { afterEach, describe, expect, it, vi } from "vitest";

const prompts = vi.hoisted(() => ({
  confirm: vi.fn(),
  intro: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === Symbol.for("clack.cancel")),
  log: {
    error: vi.fn(),
    info: vi.fn(),
    step: vi.fn(),
  },
  note: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
}));

const agentServiceMock = vi.hoisted(() => ({
  createSession: vi.fn(),
  stream: vi.fn(),
}));

const repoApiMock = vi.hoisted(() => ({
  getByName: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  confirm: prompts.confirm,
  intro: prompts.intro,
  isCancel: prompts.isCancel,
  log: prompts.log,
  note: prompts.note,
  outro: prompts.outro,
  text: prompts.text,
}));

vi.mock("@/core/repo.api", () => ({
  repoApi: repoApiMock,
}));

vi.mock("@/core/prompts", () => ({
  guardPrompt: vi.fn(async (value: unknown) => value),
}));

vi.mock("./agent.service", () => ({
  agentService: agentServiceMock,
}));

import { executeTurn, startInteractiveChat } from "./agent.repl";

afterEach(() => {
  vi.clearAllMocks();
});

describe("startInteractiveChat", () => {
  it("starts a session and exits with /exit", async () => {
    repoApiMock.getByName.mockResolvedValue({ id: "repo-1", name: "backend", owner: "acme" });
    agentServiceMock.createSession.mockResolvedValue({ id: "session-1" });
    prompts.text.mockResolvedValue("/exit");

    await startInteractiveChat("acme/backend");

    expect(repoApiMock.getByName).toHaveBeenCalledWith("acme", "backend");
    expect(agentServiceMock.createSession).toHaveBeenCalledWith({
      repoId: "repo-1",
      title: "CLI: acme/backend",
    });
    expect(prompts.note).toHaveBeenCalled();
  });
});

describe("executeTurn", () => {
  it("requests approval for pending tool calls and then continues the chat", async () => {
    const history = [{ id: "u-1", parts: [{ text: "hi", type: "text" }], role: "user" }] as any;

    agentServiceMock.stream.mockResolvedValueOnce({
      assistantMessage: {
        id: "a-1",
        parts: [
          {
            approval: { approved: false, id: "approval-1" },
            args: { q: "docs" },
            state: "approval-requested",
            toolCallId: "call-1",
            toolName: "search",
            type: "tool-search",
          },
        ],
        role: "assistant",
      },
      fullText: "",
      pendingApprovals: [
        {
          approvalId: "approval-1",
          input: { q: "docs" },
          toolCallId: "call-1",
          toolName: "search",
        },
      ],
    });
    agentServiceMock.stream.mockResolvedValueOnce({
      assistantMessage: {
        id: "a-2",
        parts: [{ text: "done", type: "text" }],
        role: "assistant",
      },
      fullText: "done",
      pendingApprovals: [],
    });
    prompts.confirm.mockResolvedValue(true);

    await executeTurn(history, "repo-1", "session-1");

    expect(prompts.confirm).toHaveBeenCalled();
    expect(agentServiceMock.stream).toHaveBeenCalledTimes(2);
    expect(history).toHaveLength(3);
  });
});
