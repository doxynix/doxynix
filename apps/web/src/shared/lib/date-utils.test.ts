import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("temporal-polyfill", () => {
  return {
    Temporal: {
      Instant: {
        fromEpochMilliseconds: vi.fn(() => ({
          toLocaleString: vi.fn(() => "January 2, 2026 at 03:04"),
          toZonedDateTimeISO: vi.fn(),
        })),
      },
      Now: {
        timeZoneId: vi.fn(() => "UTC"),
        zonedDateTimeISO: vi.fn(() => ({
          since: vi.fn(() => ({
            days: 0,
            hours: 0,
            minutes: 0,
            months: 0,
            sign: 1,
            weeks: 0,
            years: 0,
          })),
        })),
      },
    },
  };
});

import { Temporal } from "temporal-polyfill";

import { formatFullDate, formatRelativeTime } from "@/shared/lib/date-utils";

describe("shared/lib/utils:formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should return default value for null and invalid dates", () => {
    const defaultValue = "N/A";

    const fromNull = formatRelativeTime(null, "en", defaultValue);
    const fromInvalid = formatRelativeTime("not-a-date", "en", defaultValue);

    expect(fromNull).toBe(defaultValue);
    expect(fromInvalid).toBe(defaultValue);
  });

  it("should return localized relative time for supported locales", () => {
    const date = new Date("2026-02-26T12:00:00.000Z");

    const enResult = formatRelativeTime(date, "en");
    const ruResult = formatRelativeTime(date, "ru");
    const deResult = formatRelativeTime(date, "de");

    expect(enResult).not.toBe("—");
    expect(ruResult).not.toBe("—");
    expect(deResult).not.toBe("—");
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

describe("shared/lib/utils:formatFullDate", () => {
  it("should format date to readable string with locale", () => {
    const formatted = formatFullDate("2026-01-02T03:04:00.000Z", "en");

    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/at\s\d{2}:\d{2}$/);
  });
});
