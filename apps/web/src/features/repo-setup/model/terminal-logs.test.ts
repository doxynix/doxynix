import { describe, expect, it } from "vitest";

import type { LogEntry } from "./terminal-logs";
import { countLogs, filterLogs, parseLogs } from "./terminal-logs";

describe("parseLogs", () => {
  it("keeps plain lines as info with a default timestamp", () => {
    expect(parseLogs(["hello world"])).toEqual([
      { id: "log-0", level: "info", message: "hello world", timestamp: "00:00:00" },
    ]);
  });

  it("parses LEVEL:::TIMESTAMP:::MESSAGE", () => {
    expect(parseLogs(["ERROR:::12:34:56:::boom"])).toEqual([
      { id: "log-0", level: "error", message: "boom", timestamp: "12:34:56" },
    ]);
  });

  it("maps level aliases and trims whitespace", () => {
    expect(parseLogs(["err:::t:::m", " warning :::t:::m", "ok:::t:::m"])).toEqual([
      { id: "log-0", level: "error", message: "m", timestamp: "t" },
      { id: "log-1", level: "warn", message: "m", timestamp: "t" },
      { id: "log-2", level: "success", message: "m", timestamp: "t" },
    ]);
  });

  it("falls back to info for unknown or empty levels", () => {
    expect(parseLogs(["DEBUG:::t:::m", ":::t:::m"])).toEqual([
      { id: "log-0", level: "info", message: "m", timestamp: "t" },
      { id: "log-1", level: "info", message: "m", timestamp: "t" },
    ]);
  });

  it("joins multi-colon messages back", () => {
    expect(parseLogs(["INFO:::t:::a:::b"])).toEqual([
      { id: "log-0", level: "info", message: "a:::b", timestamp: "t" },
    ]);
  });

  it("keeps raw message when no message part follows the timestamp", () => {
    expect(parseLogs(["WARN:::hello"])).toEqual([
      { id: "log-0", level: "warn", message: "WARN:::hello", timestamp: "hello" },
    ]);
  });

  it("returns an empty array for non-array input", () => {
    expect(parseLogs(null as unknown as string[])).toEqual([]);
  });
});

describe("countLogs", () => {
  const sample: LogEntry[] = [
    { id: "1", level: "error", message: "a", timestamp: "t" },
    { id: "2", level: "info", message: "b", timestamp: "t" },
    { id: "3", level: "error", message: "c", timestamp: "t" },
  ];

  it("counts all and per-level entries", () => {
    expect(countLogs(sample)).toEqual({ all: 3, error: 2, info: 1, success: 0, warn: 0 });
  });

  it("returns zeroed counts for no logs", () => {
    expect(countLogs([])).toEqual({ all: 0, error: 0, info: 0, success: 0, warn: 0 });
  });
});

describe("filterLogs", () => {
  const sample: LogEntry[] = [
    { id: "1", level: "error", message: "BOOM failed", timestamp: "t" },
    { id: "2", level: "info", message: "started", timestamp: "t" },
    { id: "3", level: "info", message: "boom retry", timestamp: "t" },
  ];

  it("keeps everything for filter=all and empty search", () => {
    expect(filterLogs(sample, "all", "")).toHaveLength(3);
  });

  it("filters by level", () => {
    expect(filterLogs(sample, "error", "").map((l) => l.id)).toEqual(["1"]);
  });

  it("matches search case-insensitively", () => {
    expect(filterLogs(sample, "all", "BOOM").map((l) => l.id)).toEqual(["1", "3"]);
  });

  it("combines filter and search with AND", () => {
    expect(filterLogs(sample, "info", "boom").map((l) => l.id)).toEqual(["3"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterLogs(sample, "warn", "")).toEqual([]);
  });
});
