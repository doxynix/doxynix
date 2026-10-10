import { describe, expect, it, vi } from "vitest";

import { renderUserProfile } from "./auth.formatter";

describe("auth formatter", () => {
  it("prints a profile card with user metadata", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    renderUserProfile({
      email: "alice@example.com",
      id: "12345678-1234-1234-1234-1234567890ab",
      name: "Alice",
      role: "admin",
    } as any);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]?.[0]).toContain("Current User Profile");
    expect(logSpy.mock.calls[0]?.[0]).toContain("Alice");
    expect(logSpy.mock.calls[0]?.[0]).toContain("admin");

    logSpy.mockRestore();
  });
});
