import { afterEach, describe, expect, it, vi } from "vitest";

const { agentMutate, agentQuery } = vi.hoisted(() => ({
  agentMutate: vi.fn(),
  agentQuery: vi.fn(),
}));

vi.mock("@/core/client", () => ({
  trpc: {
    agent: {
      createSession: { mutate: agentMutate },
      getSessionHistory: { query: agentQuery },
      listSessions: { query: agentQuery },
    },
  },
}));

vi.mock("@/core/config", () => ({
  getApiUrl: () => "https://example.test/api",
  getToken: () => "token-123",
}));

vi.mock("@/ui/colors", () => ({
  brand: {
    error: (value: string) => value,
    logo: (value: string) => value,
  },
  pc: {
    bold: (value: string) => value,
    gray: (value: string) => value,
    green: (value: string) => value,
    yellow: (value: string) => value,
  },
}));

vi.mock("@/ui/icons", () => ({
  icons: {
    check: "✓",
    cross: "✕",
    pending: "…",
    warning: "!",
  },
}));

// `@/ui/markdown` is intentionally NOT mocked: stubbing renderMarkdownLine would
// hide the blank-line regression this file is meant to catch.

vi.mock("@/ui/spinner", () => ({
  createSpinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    stopAndPersist: vi.fn(),
  }),
}));

import { agentService } from "./agent.service";

describe("agent service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and listings sessions through the agent router", async () => {
    agentQuery.mockResolvedValue([{ id: "session-1" }]);

    await agentService.createSession({ repoId: "repo-1" });
    await agentService.getSessionHistory("session-1");
    await agentService.listSessions({ repoId: "repo-1" } as any);

    expect(agentMutate).toHaveBeenCalledWith({ repoId: "repo-1" });
    expect(agentQuery).toHaveBeenNthCalledWith(1, { sessionId: "session-1" });
    expect(agentQuery).toHaveBeenNthCalledWith(2, { repoId: "repo-1" });
  });

  it("parses SSE stream events and returns pending approvals", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"type":"text-delta","delta":"hello "}\n\n'));
        controller.enqueue(
          encoder.encode(
            'data: {"type":"tool-call","toolCallId":"call-1","toolName":"search"}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"tool-input-available","toolCallId":"call-1","input":{"q":"docs"}}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"tool-approval-request","toolCallId":"call-1","approvalId":"approval-1"}\n\n',
          ),
        );
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      body: stream,
      ok: true,
      status: 200,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await agentService.stream([
      {
        id: "msg-1",
        parts: [{ text: "Hi", type: "text" }],
        role: "user",
      },
    ]);

    expect(result.fullText).toBe("hello ");
    expect(result.pendingApprovals).toEqual([
      {
        approvalId: "approval-1",
        input: { q: "docs" },
        toolCallId: "call-1",
        toolName: "search",
      },
    ]);
    expect(result.assistantMessage.role).toBe("assistant");
    expect(writeSpy).toHaveBeenCalled();
  });

  it("never prints the literal text 'undefined' for blank streamed lines", async () => {
    // Blank lines are routine in streamed markdown; rendering them through a
    // function that can return undefined used to emit "undefined" per line.
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const delta of ["# Title\n", "\n", "\n", "Body text.\n", "\n"]) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ delta, type: "text-delta" })}\n\n`),
          );
        }
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ body: stream, ok: true, status: 200, text: async () => "" }),
    );

    await agentService.stream([{ id: "m", parts: [{ text: "Hi", type: "text" }], role: "user" }]);

    const written = writeSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(written).not.toContain("undefined");
  });
});
