import { describe, expect, it } from "vitest";

import {
  CodeDocEditSchema,
  changedFileSnapshotSchema,
  DocumentFilePreviewSchema,
  FixApplicationPayloadSchema,
  PrAiReviewFindingSchema,
  PrAiReviewOutputSchema,
  persistedFindingSchema,
  QuickFileAuditSchema,
} from "./analysis.schemas";

// ---------------------------------------------------------------------------
// QuickFileAuditSchema
// ---------------------------------------------------------------------------
describe("QuickFileAuditSchema", () => {
  const valid = {
    confidence: "high" as const,
    issues: ["memory leak in handler"],
    strengths: ["clean separation"],
    suggestions: ["extract to utility"],
    summary: "Solid module with minor leaks.",
  };

  it("parses a valid fixture", () => {
    expect(QuickFileAuditSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid confidence enum", () => {
    const result = QuickFileAuditSchema.safeParse({ ...valid, confidence: "extreme" });
    expect(result.success).toBe(false);
  });

  it("rejects empty summary", () => {
    const result = QuickFileAuditSchema.safeParse({ ...valid, summary: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CodeDocEditSchema
// ---------------------------------------------------------------------------
describe("CodeDocEditSchema", () => {
  const valid = { replace: "/** docs */ function foo() {}", search: "function foo() {}" };

  it("parses a valid fixture", () => {
    expect(CodeDocEditSchema.parse(valid)).toEqual(valid);
  });

  it("rejects empty-after-trim search", () => {
    const result = CodeDocEditSchema.safeParse({ ...valid, search: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects empty-after-trim replace", () => {
    const result = CodeDocEditSchema.safeParse({ ...valid, replace: "  \n  " });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DocumentFilePreviewSchema
// ---------------------------------------------------------------------------
describe("DocumentFilePreviewSchema", () => {
  const valid = {
    confidence: "medium" as const,
    edits: [{ replace: "/** doc */ class A {}", search: "class A {}" }],
    summary: "Analyzed module A.",
  };

  it("parses a valid fixture", () => {
    expect(DocumentFilePreviewSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid confidence", () => {
    const result = DocumentFilePreviewSchema.safeParse({ ...valid, confidence: "none" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// changedFileSnapshotSchema
// ---------------------------------------------------------------------------
describe("changedFileSnapshotSchema", () => {
  const valid = {
    additions: 10,
    deletions: 3,
    filePath: "src/app.ts",
    status: "modified" as const,
  };

  it("parses a valid fixture", () => {
    expect(changedFileSnapshotSchema.parse(valid)).toEqual(valid);
  });

  it("parses with optional previousFilePath", () => {
    const withPrev = { ...valid, previousFilePath: "src/old.ts" };
    expect(changedFileSnapshotSchema.parse(withPrev)).toEqual(withPrev);
  });

  it("rejects negative additions", () => {
    const result = changedFileSnapshotSchema.safeParse({ ...valid, additions: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status enum", () => {
    const result = changedFileSnapshotSchema.safeParse({ ...valid, status: "deleted" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// persistedFindingSchema
// ---------------------------------------------------------------------------
describe("persistedFindingSchema", () => {
  const valid = {
    file: "src/index.ts",
    line: 42,
    message: "Potential null deref",
    title: "Null check",
    type: "BUG",
  };

  it("parses a valid fixture", () => {
    expect(persistedFindingSchema.parse(valid)).toEqual(valid);
  });

  it("parses with optional score", () => {
    expect(persistedFindingSchema.parse({ ...valid, score: 5 })).toHaveProperty("score", 5);
  });

  it("rejects line < 1", () => {
    const result = persistedFindingSchema.safeParse({ ...valid, line: 0 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FixApplicationPayloadSchema
// ---------------------------------------------------------------------------
describe("FixApplicationPayloadSchema", () => {
  const valid = {
    branch: "main",
    fixedFiles: [{ filePath: "src/a.ts", newContent: "code" }],
    fixId: "550e8400-e29b-41d4-a716-446655440000",
    repoId: "550e8400-e29b-41d4-a716-446655440001",
    title: "Fix null deref",
  };

  it("parses a valid fixture", () => {
    expect(FixApplicationPayloadSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid fixId uuid", () => {
    const result = FixApplicationPayloadSchema.safeParse({ ...valid, fixId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects empty fixedFiles array", () => {
    const result = FixApplicationPayloadSchema.safeParse({ ...valid, fixedFiles: [] });
    expect(result.success).toBe(false);
  });

  it("rejects empty branch", () => {
    const result = FixApplicationPayloadSchema.safeParse({ ...valid, branch: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PrAiReviewFindingSchema
// ---------------------------------------------------------------------------
describe("PrAiReviewFindingSchema", () => {
  const valid = {
    file: "src/api.ts",
    line: 12,
    message: "SQL injection risk",
    score: 9,
    title: "SQL Injection",
    type: "SECURITY" as const,
  };

  it("parses a valid fixture", () => {
    expect(PrAiReviewFindingSchema.parse(valid)).toEqual(valid);
  });

  it("rejects score below min", () => {
    const result = PrAiReviewFindingSchema.safeParse({ ...valid, score: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects score above max", () => {
    const result = PrAiReviewFindingSchema.safeParse({ ...valid, score: 11 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type enum", () => {
    const result = PrAiReviewFindingSchema.safeParse({ ...valid, type: "TYPO" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PrAiReviewOutputSchema
// ---------------------------------------------------------------------------
describe("PrAiReviewOutputSchema", () => {
  const valid = {
    findings: [
      {
        file: "src/api.ts",
        line: 12,
        message: "Risk",
        score: 5,
        title: "Issue",
        type: "BUG" as const,
      },
    ],
    summary: "Reviewed PR.",
  };

  it("parses a valid fixture", () => {
    expect(PrAiReviewOutputSchema.parse(valid)).toEqual(valid);
  });
});
