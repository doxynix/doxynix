import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAdapters: Array<{ parse: (file: any) => Promise<any> }> = [];

vi.mock("../adapters/registry", () => ({
  getLanguageAdapters: () => mockAdapters,
}));

vi.mock("./regex-signals", () => ({
  collectRegexSignals: () => ({
    analysisMode: "heuristic",
    apiSurface: 0,
    complexityMetrics: { complexity: 0, maxNesting: 0 },
    entrypointHint: false,
    exports: 0,
    imports: [],
    symbols: [],
  }),
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { appLogger } from "@/server/core/app-logger";

import { collectPolyglotSignals } from "./language-signals";

describe("collectPolyglotSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapters.length = 0;
  });

  it("returns parser results for a source file and preserves path categories", async () => {
    mockAdapters.push({
      parse: async () => ({
        analysisMode: "typescript-ast",
        apiSurface: 2,
        complexityMetrics: { complexity: 3, maxNesting: 1 },
        entrypointHint: false,
        exports: 1,
        imports: ["./helper"],
        symbols: [],
      }),
    });

    const result = await collectPolyglotSignals({
      content: "export const answer = 42;",
      path: "src/app.ts",
    });

    expect(result.analysisMode).toBe("typescript-ast");
    expect(result.categories).toContain("runtime-source");
    expect(result.imports).toEqual(["./helper"]);
  });

  it("skips adapter when it returns null and tries next one", async () => {
    mockAdapters.push(
      { parse: async () => null },
      {
        parse: async () => ({
          analysisMode: "tree-sitter",
          apiSurface: 1,
          complexityMetrics: { complexity: 1, maxNesting: 1 },
          entrypointHint: true,
          exports: 1,
          imports: [],
          symbols: [],
        }),
      },
    );

    const result = await collectPolyglotSignals({
      content: "package main",
      path: "src/main.go",
    });

    expect(result.analysisMode).toBe("tree-sitter");
  });

  it("logs debug and falls back to regex signals when all adapters throw", async () => {
    mockAdapters.push({
      parse: async () => {
        throw new Error("AST parser crash");
      },
    });

    const result = await collectPolyglotSignals({
      content: "export const fallback = true;",
      path: "src/legacy.ts",
    });

    expect(result.analysisMode).toBe("heuristic");
    expect(appLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Language adapter failed, trying next parser" }),
    );
  });

  it("attaches configRefs when path is classified as config", async () => {
    const result = await collectPolyglotSignals({
      content: "{}",
      path: "tsconfig.json",
    });

    expect(result.configRefs).toEqual([
      {
        confidence: 90,
        kind: "tsconfig.json",
        path: "tsconfig.json",
      },
    ]);
  });
});
