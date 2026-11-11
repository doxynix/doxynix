import { describe, expect, it } from "vitest";

import { buildFileDiff } from "./file-diff";

describe("buildFileDiff", () => {
  it("reports additions and deletions for a modified file", () => {
    const diff = buildFileDiff("one\ntwo\n", "one\nthree\n");

    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(1);
    expect(diff.rows).toEqual([
      { header: "@@ -1,2 +1,2 @@", kind: "hunk" },
      { content: "one", kind: "context", newLine: 1, oldLine: 1 },
      { content: "two", kind: "remove", newLine: null, oldLine: 2 },
      { content: "three", kind: "add", newLine: 2, oldLine: null },
    ]);
  });

  it("marks every line of a newly added file as an addition", () => {
    const diff = buildFileDiff("", "one\ntwo\n");

    expect(diff.additions).toBe(2);
    expect(diff.deletions).toBe(0);
    expect(diff.rows.filter((row) => row.kind === "add")).toHaveLength(2);
  });

  it("returns no rows when the file is unchanged", () => {
    expect(buildFileDiff("same\n", "same\n")).toEqual({
      additions: 0,
      deletions: 0,
      rows: [],
    });
  });

  it("ignores the no-newline marker without breaking line numbers", () => {
    const diff = buildFileDiff("old", "new");

    expect(diff.additions).toBe(1);
    expect(diff.deletions).toBe(1);
    expect(diff.rows).toEqual([
      { header: "@@ -1,1 +1,1 @@", kind: "hunk" },
      { content: "old", kind: "remove", newLine: null, oldLine: 1 },
      { content: "new", kind: "add", newLine: 1, oldLine: null },
    ]);
  });
});
