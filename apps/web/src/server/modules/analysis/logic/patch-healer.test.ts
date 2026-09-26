import { describe, expect, it } from "vitest";

import {
  buildLineMappingFromPatch,
  getCommentableLinesFromPatch,
  healAndPartitionFindings,
  healFindingLine,
} from "./patch-healer";
import type { PRFinding } from "./pr.types";

/**
 * New-file line numbering after the hunk header sets the cursor to 10:
 *   " const untouched = 1;"  context -> 10, cursor 11
 *   "-const removed = 2;"    removal -> not commentable, cursor stays 11
 *   "+const added = 3;"      added   -> 11, cursor 12
 *   "+const alsoAdded = 4;"  added   -> 12, cursor 13
 *   " return added;"         context -> 13, cursor 14
 *   "}"                      context -> 14
 */
const PATCH = [
  "@@ -10,7 +10,8 @@ export function run() {",
  " const untouched = 1;",
  "-const removed = 2;",
  "+const added = 3;",
  "+const alsoAdded = 4;",
  " return added;",
  "}",
  "\\ No newline at end of file",
].join("\n");

function makeFinding(overrides: Partial<PRFinding> = {}): PRFinding {
  return {
    file: "src/app.ts",
    line: 1,
    message: "msg",
    score: 5,
    severity: "MEDIUM",
    title: "title",
    type: "BUG",
    ...overrides,
  };
}

/** `noUncheckedIndexedAccess` makes `arr[0]` nullable; these tests always expect one. */
function only<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  return items[0] as T;
}

describe("getCommentableLinesFromPatch", () => {
  it("returns an empty set for an empty patch", () => {
    expect(getCommentableLinesFromPatch("")).toEqual(new Set());
  });

  it("numbers context and added lines from the hunk header", () => {
    expect([...getCommentableLinesFromPatch(PATCH)]).toEqual([10, 11, 12, 13, 14]);
  });

  it("does not advance the new-file cursor for removed lines", () => {
    // The removed line sits at old-file 11; that number is never commentable
    // because it was never present in the new file.
    const lines = getCommentableLinesFromPatch(PATCH);
    expect(lines.has(11)).toBe(true); // 11 is "+const added = 3;" in the new file
    expect(getCommentableLinesFromPatch("@@ -1,3 +1,2 @@\n-a\n-b\n+c")).toEqual(new Set([1]));
  });

  it("skips the +++ and --- file headers", () => {
    const withHeaders = [
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,2 +1,2 @@",
      " a",
      "+b",
    ].join("\n");

    expect([...getCommentableLinesFromPatch(withHeaders)]).toEqual([1, 2]);
  });

  it("ignores lines appearing before any hunk header", () => {
    expect([...getCommentableLinesFromPatch("stray context\n+stray add")]).toEqual([]);
  });

  it("restarts numbering at each hunk", () => {
    const twoHunks = ["@@ -1,2 +1,2 @@", "+a", "@@ -50,2 +90,2 @@", "+b"].join("\n");
    expect([...getCommentableLinesFromPatch(twoHunks)]).toEqual([1, 90]);
  });

  it("parses a hunk header without line counts", () => {
    expect([...getCommentableLinesFromPatch("@@ -1 +7 @@\n+x")]).toEqual([7]);
  });
});

describe("buildLineMappingFromPatch", () => {
  it("returns an empty map for an empty patch", () => {
    expect(buildLineMappingFromPatch("").size).toBe(0);
  });

  it("maps added lines to their new-file line number", () => {
    const map = buildLineMappingFromPatch(PATCH);
    expect(map.get("const added = 3;")).toBe(11);
    expect(map.get("const alsoAdded = 4;")).toBe(12);
  });

  it("does not map context or removed lines", () => {
    const map = buildLineMappingFromPatch(PATCH);
    expect(map.has("const untouched = 1;")).toBe(false);
    expect(map.has("const removed = 2;")).toBe(false);
  });

  it("skips blank added lines", () => {
    expect(buildLineMappingFromPatch("@@ -1,2 +1,2 @@\n+\n+x").has("")).toBe(false);
  });

  it("keeps the last mapping when the same text is added twice", () => {
    const map = buildLineMappingFromPatch("@@ -1,1 +1,3 @@\n+same\n+y\n+same");
    expect(map.get("same")).toBe(3);
  });
});

describe("healFindingLine", () => {
  const lineMap = buildLineMappingFromPatch(PATCH);

  it("resolves an exact snippet match", () => {
    expect(healFindingLine(lineMap, "const added = 3;", 999)).toBe(11);
  });

  it("strips a leading +/- prefix from the snippet", () => {
    expect(healFindingLine(lineMap, "+const alsoAdded = 4;", 999)).toBe(12);
  });

  it("resolves when the snippet contains a mapped line", () => {
    expect(healFindingLine(lineMap, "  // ctx\n  const added = 3;", 999)).toBe(11);
  });

  it("falls back to the reported line when nothing matches", () => {
    expect(healFindingLine(lineMap, "totally unrelated text", 42)).toBe(42);
  });

  it("falls back to the reported line for an empty snippet", () => {
    expect(healFindingLine(lineMap, "   \n  ", 7)).toBe(7);
  });

  it("resolves a near-identical line above the fuzzy threshold", () => {
    // Jaccard on tokens = 6/7 = 0.857 > 0.75, and neither substring check fires.
    const map = new Map([
      ["const total = computeTotal(items) + applyTax(total) + round(total)", 5],
    ]);

    expect(
      healFindingLine(
        map,
        "const total = computeTotal(items) + applyTax(total) + round(totals)",
        1,
      ),
    ).toBe(5);
  });

  it("does not fuzzy-match below the threshold", () => {
    // Jaccard on tokens = 3/5 = 0.6 < 0.75.
    const map = new Map([["const total = computeTotal(items);", 5]]);

    expect(healFindingLine(map, "const total = computeTotal(item);", 1)).toBe(1);
  });
});

describe("healAndPartitionFindings", () => {
  it("partitions findings that land on commentable lines", () => {
    const { commentable, findings } = healAndPartitionFindings({
      changedFiles: [{ filename: "src/app.ts", patch: PATCH }],
      findings: [makeFinding({ codeSnippet: "const added = 3;", line: 999 })],
    });

    expect(commentable).toHaveLength(1);
    expect(only(findings).line).toBe(11);
  });

  it("excludes findings whose corrected line falls outside the patch", () => {
    const { commentable, findings } = healAndPartitionFindings({
      changedFiles: [{ filename: "src/app.ts", patch: PATCH }],
      findings: [makeFinding({ codeSnippet: "const never = 0;", line: 500 })],
    });

    expect(commentable).toHaveLength(0);
    expect(only(findings).line).toBe(500);
  });

  it("corrects the line in place so the caller's array is repaired too", () => {
    const input = [makeFinding({ codeSnippet: "const alsoAdded = 4;", line: 1 })];
    const { findings } = healAndPartitionFindings({
      changedFiles: [{ filename: "src/app.ts", patch: PATCH }],
      findings: input,
    });

    expect(findings).toBe(input);
    expect(only(input).line).toBe(12);
  });

  it("passes findings through untouched when the file has no patch", () => {
    const { commentable, findings } = healAndPartitionFindings({
      changedFiles: [{ filename: "src/app.ts" }],
      findings: [makeFinding({ line: 3 })],
    });

    expect(commentable).toHaveLength(0);
    expect(only(findings).line).toBe(3);
  });

  it("leaves the line alone when the finding has no code snippet", () => {
    const { commentable, findings } = healAndPartitionFindings({
      changedFiles: [{ filename: "src/app.ts", patch: PATCH }],
      findings: [makeFinding({ line: 12 })],
    });

    expect(only(findings).line).toBe(12);
    expect(commentable).toHaveLength(1);
  });

  it("normalises the finding path before matching a patch", () => {
    const { commentable } = healAndPartitionFindings({
      changedFiles: [{ filename: "src/app.ts", patch: PATCH }],
      findings: [makeFinding({ file: "./src/app.ts", line: 11 })],
    });

    expect(commentable).toHaveLength(1);
  });

  it("matches each finding against its own file patch", () => {
    const otherPatch = ["@@ -1,2 +40,2 @@", "+alpha", "+beta"].join("\n");
    const { commentable } = healAndPartitionFindings({
      changedFiles: [
        { filename: "src/app.ts", patch: PATCH },
        { filename: "src/other.ts", patch: otherPatch },
      ],
      findings: [makeFinding({ file: "src/other.ts", line: 41 })],
    });

    expect(commentable).toHaveLength(1);
    expect(only(commentable).line).toBe(41);
  });

  it("returns an empty partition for no findings", () => {
    const result = healAndPartitionFindings({
      changedFiles: [{ filename: "src/app.ts", patch: PATCH }],
      findings: [],
    });

    expect(result.commentable).toEqual([]);
    expect(result.findings).toEqual([]);
  });
});
