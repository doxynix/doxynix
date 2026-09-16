import { describe, expect, it } from "vitest";

import { CommentFormatter } from "./comment-poster";
import type { PRFinding } from "./pr.types";

describe("CommentFormatter", () => {
  const baseFinding: PRFinding = {
    file: "src/utils.ts",
    line: 12,
    message: "Potential memory leak detected in event listener.",
    score: 8,
    severity: "HIGH",
    suggestion: "element.removeEventListener('click', handler);",
    title: "Memory Leak",
    type: "PERFORMANCE",
  };

  it("formats finding in CONCISE style", () => {
    const formatted = CommentFormatter.formatFinding(baseFinding, "CONCISE");

    expect(formatted).toContain("**PERFORMANCE** (HIGH, score 8/10)");
    expect(formatted).toContain("Potential memory leak detected");
    expect(formatted).toContain("<!-- doxynix-signature:");
  });

  it("formats full markdown finding with code suggestions", () => {
    const formatted = CommentFormatter.formatFinding(baseFinding, "DETAILED");

    expect(formatted).toContain("## Memory Leak");
    expect(formatted).toContain("**AI Suggested Fix:**");
    expect(formatted).toContain("```suggestion");
    expect(formatted).toContain("element.removeEventListener");
  });

  it("correctly identifies plain sentences as non-code tips", () => {
    expect(CommentFormatter.isProbablyNotCode("Consider splitting this into multiple files.")).toBe(
      true,
    );
    expect(
      CommentFormatter.isProbablyNotCode("const total = items.reduce((a, b) => a + b, 0);"),
    ).toBe(false);
  });

  it("sanitizes code fence backticks from suggestion strings", () => {
    const raw = "```typescript\nconst clean = true;\n```";
    expect(CommentFormatter.sanitizeSuggestion(raw)).toBe("const clean = true;");
  });
});
