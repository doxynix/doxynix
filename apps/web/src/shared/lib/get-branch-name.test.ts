import { afterEach, describe, expect, it, vi } from "vitest";

import { generateBranchName } from "@/shared/lib/get-branch-name";

describe("shared/lib/utils:generateBranchName", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("formats UTC date parts with a random salt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T10:15:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    expect(generateBranchName()).toBe("doxynix/260913-1015-3lll");
  });

  it("reflects the current UTC time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T23:45:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    expect(generateBranchName()).toBe("doxynix/260105-2345-3lll");
  });

  it("matches the doxynix/YYMMDD-HHMM-salt format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T10:15:00Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    expect(generateBranchName()).toMatch(/^doxynix\/[0-9]{6}-[0-9]{4}-[a-z0-9]{4}$/);
  });
});
