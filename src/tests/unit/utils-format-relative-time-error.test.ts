import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime } from "@/shared/lib/utils";

describe("formatRelativeTime error fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return default value and log error when formatter throws", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const temporalSpy = vi
      .spyOn(Temporal.Instant, "fromEpochMilliseconds")
      .mockImplementation(() => {
        throw new Error("Temporal mock crash");
      });

    const result = formatRelativeTime("2026-01-01T00:00:00.000Z", "en", "fallback");

    expect(result).toBe("fallback");
    expect(errorSpy).toHaveBeenCalledWith("Date formatting error:", expect.any(Error));

    temporalSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
