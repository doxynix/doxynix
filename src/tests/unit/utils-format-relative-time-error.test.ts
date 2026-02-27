import { afterEach, describe, expect, it, vi } from "vitest";

describe("formatRelativeTime error fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("date-fns/formatDistanceToNow");
  });

  it("should return default value and log error when formatter throws", async () => {
    vi.doMock("date-fns/formatDistanceToNow", () => ({
      formatDistanceToNow: vi.fn(() => {
        throw new Error("Formatter failed");
      }),
    }));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { formatRelativeTime } = await import("@/shared/lib/utils");

    const result = formatRelativeTime("2026-01-01T00:00:00.000Z", "en", "fallback");

    expect(result).toBe("fallback");
    expect(errorSpy).toHaveBeenCalledWith("Date formatting error:", expect.any(Error));
  });
});
