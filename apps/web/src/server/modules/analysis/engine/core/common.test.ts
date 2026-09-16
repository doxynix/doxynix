import { describe, expect, it } from "vitest";

import { buildEvidence, calculateDocDensity } from "./common";

describe("calculateDocDensity", () => {
  it("returns 0 when there are no lines at all", () => {
    expect(calculateDocDensity(0, 0)).toBe(0);
  });

  it("returns 0 when there is no comment content", () => {
    expect(calculateDocDensity(4, 0)).toBe(0);
  });

  it("returns 100 for comment-only content", () => {
    expect(calculateDocDensity(0, 5)).toBe(100);
  });

  it("calculates the comment density percentage", () => {
    expect(calculateDocDensity(10, 10)).toBe(50);
    expect(calculateDocDensity(7, 3)).toBe(30);
    expect(calculateDocDensity(20, 8)).toBe(29);
  });
});

describe("buildEvidence", () => {
  it("normalizes paths and attaches the optional note", () => {
    expect(buildEvidence(["src/a.ts", "src/./b.ts"], "reason")).toEqual([
      { note: "reason", path: "src/a.ts" },
      { note: "reason", path: "src/b.ts" },
    ]);
  });

  it("maps paths without a note", () => {
    expect(buildEvidence(["src/a.ts"])).toEqual([{ path: "src/a.ts" }]);
  });
});
