import { describe, expect, it } from "vitest";

import { stripAnsi } from "@/ui/formatters";

import { renderLinkedAccountsTable, renderSessionsTable } from "./profile.formatter";

describe("profile formatter", () => {
  it("renders a table of active sessions", () => {
    const output = renderSessionsTable([
      {
        createdAt: "2024-01-01T00:00:00.000Z",
        id: "abcdef12",
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      },
    ] as any);

    expect(output).toContain("Session ID");
    expect(output).toContain("Mozilla/5.0");
    expect(output).toContain("127.0.0.1");
  });

  it("renders the short session id that revoke-session targets", () => {
    // revoke-session resolves by the first 8 characters, so the table must show
    // that prefix or the user cannot pick the right row.
    const output = stripAnsi(
      renderSessionsTable([
        {
          createdAt: "2024-01-01T00:00:00.000Z",
          id: "abcdef12-rest-of-the-id",
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
        },
      ] as any),
    );

    expect(output).toContain("abcdef12");
    expect(output).not.toContain("abcdef12-rest-of-the-id");
  });

  it("falls back to a placeholder when the user agent is missing", () => {
    const output = stripAnsi(
      renderSessionsTable([
        { createdAt: "2024-01-01T00:00:00.000Z", id: "abcdef12", ipAddress: "127.0.0.1" },
      ] as any),
    );

    expect(output).toContain("Unknown Device");
  });

  it("renders the linked accounts table", () => {
    const output = renderLinkedAccountsTable([
      { email: "a@example.com", name: "Alice", provider: "github" },
      { email: "b@example.com", name: "Bob", provider: "google" },
    ] as any);

    expect(output).toContain("GITHUB");
    expect(output).toContain("GOOGLE");
    expect(output).toContain("Alice");
    expect(output).toContain("Bob");
  });
});
