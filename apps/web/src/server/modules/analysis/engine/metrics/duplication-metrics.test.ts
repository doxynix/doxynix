import { describe, expect, it, vi } from "vitest";

import { calculateRepositoryDuplication } from "./duplication-metrics";

vi.mock("@jscpd/core", () => {
  return {
    Detector: vi.fn(function DetectorMock() {
      return {
        detect: vi.fn(async () => [
          {
            duplicationA: {
              end: { line: 10 },
              fragment: "line1\nline2\nline3\nline4\nline5\nline6",
              sourceId: "file1.ts",
              start: { line: 5 },
            },
            duplicationB: {
              end: { line: 20 },
              sourceId: "file2.ts",
              start: { line: 15 },
            },
          },
        ]),
      };
    }),
    MemoryStore: vi.fn(function MemoryStoreMock() {
      return {
        close: vi.fn(),
      };
    }),
  };
});

vi.mock("@jscpd/tokenizer", () => ({
  getFormatByFile: vi.fn((path) => (path === "ignore.ts" ? undefined : "typescript")),
  Tokenizer: vi.fn(),
}));

vi.mock("../core/project-policy", () => ({
  ProjectPolicy: {
    isConfigFile: vi.fn((path) => path.endsWith("config.ts")),
    isTestFile: vi.fn((path) => path.endsWith(".test.ts")),
  },
}));

describe("calculateRepositoryDuplication", () => {
  it("should return fallback report for empty input", async () => {
    const report = await calculateRepositoryDuplication([]);
    expect(report).toEqual({
      clones: [],
      duplicationPercentage: 0,
      totalDuplicatedLines: 0,
    });
  });

  it("should calculate duplication report with clones", async () => {
    const files = [
      {
        content: "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10",
        path: "file1.ts",
      },
      {
        content:
          "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11\nline12\nline13\nline14\nline15\nline16\nline17\nline18\nline19\nline20",
        path: "file2.ts",
      },
    ] as any;
    const report = await calculateRepositoryDuplication(files);

    // Mocked detector yields two 6-line clones over 10 + 20 = 30 lines → 12 duplicated (40%)
    expect(report.totalDuplicatedLines).toBe(12);
    expect(report.duplicationPercentage).toBe(40);
  });
});
