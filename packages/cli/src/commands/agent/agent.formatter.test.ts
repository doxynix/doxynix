import { describe, expect, it } from "vitest";

import {
  extractMessageContent,
  renderSessionHistory,
  renderSessionsTable,
} from "./agent.formatter";

describe("agent formatter", () => {
  it("extracts plain text from mixed message parts", () => {
    const content = extractMessageContent([
      { text: "hello", type: "text" },
      {
        args: { query: "repo" },
        state: "input-available",
        toolCallId: "tool-1",
        toolName: "search",
        type: "tool-search",
      },
      { text: " world", type: "text" },
    ]);

    expect(content).toBe("hello\n world");
  });

  it("renders user and assistant history with separators", () => {
    const output = renderSessionHistory([
      { id: "a", parts: [{ text: "what is this?", type: "text" }], role: "user" },
      { id: "b", parts: [{ text: "it is a test", type: "text" }], role: "assistant" },
    ] as any);

    expect(output).toContain("You:");
    expect(output).toContain("Doxynix AI:");
    expect(output).toContain("what is this?");
    expect(output).toContain("it is a test");
  });

  it("renders sessions as a table with repo context", () => {
    const output = renderSessionsTable([
      {
        id: "12345678",
        repo: { name: "platform", owner: "acme" },
        title: "Demo session",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ] as any);

    expect(output).toContain("Session ID");
    expect(output).toContain("Demo session");
    expect(output).toContain("acme/platform");
  });
});
