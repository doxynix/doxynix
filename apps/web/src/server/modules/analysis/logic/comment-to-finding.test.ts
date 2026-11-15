import { describe, expect, it } from "vitest";

import { commentsToFindings, commentToFinding } from "./comment-to-finding";

describe("commentToFinding", () => {
  it("normalises the finding type and maps the fields", () => {
    expect(
      commentToFinding({
        filePath: "src/a.ts",
        findingType: "SECURITY",
        line: 42,
        suggestion: "<p>x</p>",
      }),
    ).toEqual({ file: "src/a.ts", line: 42, suggestion: "<p>x</p>", type: "security" });
  });
});

describe("commentsToFindings", () => {
  it("maps every comment in the order it was read", () => {
    expect(
      commentsToFindings([
        { filePath: "src/a.ts", findingType: "BUG", line: 1, suggestion: "a" },
        { filePath: "src/b.ts", findingType: "STYLE", line: 2, suggestion: "b" },
      ]),
    ).toEqual([
      { file: "src/a.ts", line: 1, suggestion: "a", type: "bug" },
      { file: "src/b.ts", line: 2, suggestion: "b", type: "style" },
    ]);
  });

  it("returns no findings for an analysis without comments", () => {
    expect(commentsToFindings([])).toEqual([]);
  });
});
