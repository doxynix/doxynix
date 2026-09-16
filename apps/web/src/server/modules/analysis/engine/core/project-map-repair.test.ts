import { describe, expect, it } from "vitest";

import {
  normalizeProjectMapKeyDecisions,
  normalizeProjectMapLanguageBreakdown,
  parseEmbeddedProjectMap,
} from "./project-map-repair";

describe("project-map-repair", () => {
  it("parses an embedded project map from a loose markdown-like blob", () => {
    const value = [
      "Project overview",
      ', "key_decisions":[{"decision":"Keep modules small","rationale":"Simplify onboarding"}, "Use typed boundaries"],',
      ' "language_breakdown":{"primary":"TypeScript","frameworks":["React","Node"],"secondary":["Docker"]}',
    ].join("");

    const parsed = parseEmbeddedProjectMap(value);

    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      key_decisions: expect.any(Array),
      language_breakdown: expect.any(Object),
      overview: "Project overview",
    });
  });

  it("normalizes array-based key decisions into stable objects", () => {
    const normalized = normalizeProjectMapKeyDecisions([
      "Prefer vertical slices",
      { decision: "Separate runtime and tooling", rationale: "Keep concerns apart" },
    ]);

    expect(normalized).toEqual([
      expect.objectContaining({ decision: "Prefer vertical slices" }),
      expect.objectContaining({ decision: "Separate runtime and tooling" }),
    ]);
  });

  it("normalizes language breakdown metadata and keeps a fallback primary language", () => {
    const normalized = normalizeProjectMapLanguageBreakdown({
      frameworks: ["React", "Node"],
      primary: "TypeScript",
      secondary: ["CSS"],
    });

    expect(normalized).toEqual({
      frameworks: ["React", "Node"],
      primary: "TypeScript",
      secondary: ["CSS"],
    });

    const fallback = normalizeProjectMapLanguageBreakdown({ JavaScript: 42, Python: 12 });
    expect(fallback).toMatchObject({
      primary: "JavaScript",
      secondary: ["Python"],
    });
  });
});
