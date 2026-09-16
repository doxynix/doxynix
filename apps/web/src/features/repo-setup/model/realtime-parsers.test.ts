import { describe, expect, it } from "vitest";

import { parseProgress, parseStatusMessage, parseTaskLogs } from "./realtime-parsers";

describe("parseProgress", () => {
  it("parses a valid percent", () => {
    expect(parseProgress(42)).toBe(42);
  });

  it("accepts the 0 and 100 boundaries", () => {
    expect(parseProgress(0)).toBe(0);
    expect(parseProgress(100)).toBe(100);
  });

  it("falls back to 0 for out-of-range values", () => {
    expect(parseProgress(-5)).toBe(0);
    expect(parseProgress(150)).toBe(0);
  });

  it("falls back to 0 for non-numbers", () => {
    expect(parseProgress("42")).toBe(0);
    expect(parseProgress(null)).toBe(0);
    expect(parseProgress(undefined)).toBe(0);
  });
});

describe("parseStatusMessage", () => {
  it("parses a string", () => {
    expect(parseStatusMessage("Cloning…")).toBe("Cloning…");
  });

  it("falls back to the default message", () => {
    expect(parseStatusMessage(42)).toBe("Analyzing repository…");
    expect(parseStatusMessage(null)).toBe("Analyzing repository…");
  });
});

describe("parseTaskLogs", () => {
  it("parses a string array", () => {
    expect(parseTaskLogs(["clone", "compile"])).toEqual(["clone", "compile"]);
  });

  it("falls back to an empty array", () => {
    expect(parseTaskLogs("nope")).toEqual([]);
    expect(parseTaskLogs(null)).toEqual([]);
  });
});
