import { describe, expect, it } from "vitest";

import { aggregateScanResults, type FileScanResult } from "./code-metric-scan";

function makeResult(params: {
  comments: number;
  complexity: number;
  maxNesting: number;
  mode: "heuristic" | "tree-sitter" | "typescript-ast";
  path: string;
  prettyName: string;
  securityIssues: number;
  securityScanStatus: "ok" | "partial";
  size: number;
  source: number;
  todos: number;
}): FileScanResult {
  return {
    comments: params.comments,
    complexity: params.complexity,
    maxNesting: params.maxNesting,
    normalizedPath: params.path,
    prettyName: params.prettyName,
    securityFindings:
      params.securityIssues > 0
        ? [{ line: 1, message: "issue", path: params.path, severity: "warning" }]
        : [],
    securityIssues: params.securityIssues,
    securityScanStatus: params.securityScanStatus,
    signal: {
      analysisMode: params.mode,
    } as any,
    size: params.size,
    source: params.source,
    todos: params.todos,
  };
}

describe("aggregateScanResults", () => {
  it("aggregates totals, parser coverage, and the most complex files", () => {
    const results = [
      makeResult({
        comments: 5,
        complexity: 80,
        maxNesting: 9,
        mode: "typescript-ast",
        path: "src/server/core/service.ts",
        prettyName: "TypeScript",
        securityIssues: 1,
        securityScanStatus: "partial",
        size: 500,
        source: 50,
        todos: 2,
      }),
      makeResult({
        comments: 2,
        complexity: 42,
        maxNesting: 4,
        mode: "tree-sitter",
        path: "src/server/utils/cleanup.ts",
        prettyName: "TypeScript",
        securityIssues: 1,
        securityScanStatus: "ok",
        size: 400,
        source: 30,
        todos: 1,
      }),
      makeResult({
        comments: 0,
        complexity: 10,
        maxNesting: 2,
        mode: "heuristic",
        path: "docs/guide.md",
        prettyName: "Markdown",
        securityIssues: 0,
        securityScanStatus: "ok",
        size: 200,
        source: 20,
        todos: 0,
      }),
    ];

    const aggregation = aggregateScanResults(results);

    expect(aggregation.totals).toMatchObject({
      comments: 7,
      maxNesting: 9,
      securityIssues: 2,
      size: 1100,
      source: 100,
      todos: 3,
    });
    expect(aggregation.analysisCoverage).toMatchObject({
      parserCoveragePercent: 67,
      totalFiles: 3,
      treeSitterFiles: 1,
      typeScriptAstFiles: 1,
    });
    expect(aggregation.languages.map((language) => language.name)).toEqual([
      "TypeScript",
      "Markdown",
    ]);
    expect(aggregation.mostComplexFiles).toEqual([
      "src/server/core/service.ts",
      "src/server/utils/cleanup.ts",
    ]);
    expect(aggregation.securityScanStatus).toBe("partial");
    expect(aggregation.securityFindings).toHaveLength(2);
  });

  it("falls back to the ranked file list when no file clears the complexity threshold", () => {
    const aggregation = aggregateScanResults([
      makeResult({
        comments: 1,
        complexity: 4,
        maxNesting: 2,
        mode: "heuristic",
        path: "src/server/low-signal.ts",
        prettyName: "UnknownLanguage",
        securityIssues: 0,
        securityScanStatus: "ok",
        size: 80,
        source: 12,
        todos: 0,
      }),
    ]);

    expect(aggregation.mostComplexFiles).toEqual(["src/server/low-signal.ts"]);
    expect(aggregation.languages).toEqual([
      expect.objectContaining({ color: "#cccccc", lines: 12, name: "UnknownLanguage" }),
    ]);
  });

  it("returns no complex files when no architecture-relevant file qualifies", () => {
    const aggregation = aggregateScanResults([
      makeResult({
        comments: 0,
        complexity: 4,
        maxNesting: 1,
        mode: "heuristic",
        path: "config/app.config.ts",
        prettyName: "Config",
        securityIssues: 0,
        securityScanStatus: "ok",
        size: 50,
        source: 10,
        todos: 0,
      }),
    ]);

    expect(aggregation.mostComplexFiles).toEqual([]);
    expect(aggregation.analysisCoverage.totalFiles).toBe(1);
  });
});
