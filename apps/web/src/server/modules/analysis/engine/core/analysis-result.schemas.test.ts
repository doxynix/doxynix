import { describe, expect, it } from "vitest";

import { aiSchema, projectMapSchema, sentinelSchema } from "./analysis-result.schemas";

describe("projectMapSchema", () => {
  it("accepts a valid project map", () => {
    const parsed = projectMapSchema.safeParse({
      language_breakdown: { frameworks: ["Hono"], primary: "TypeScript" },
      modules: [{ path: "src/app.ts", responsibility: "Entry", type: "module" }],
      overview: "Topology",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts an empty module list", () => {
    const parsed = projectMapSchema.safeParse({ modules: [], overview: "Topology" });

    expect(parsed.success).toBe(true);
  });

  it("rejects modules without a path", () => {
    const parsed = projectMapSchema.safeParse({
      modules: [{ responsibility: "Entry", type: "module" }],
      overview: "Topology",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a missing overview", () => {
    const parsed = projectMapSchema.safeParse({ modules: [] });

    expect(parsed.success).toBe(false);
  });
});

describe("sentinelSchema", () => {
  it("accepts a valid sentinel status without a reason", () => {
    expect(sentinelSchema.safeParse({ status: "SAFE" }).success).toBe(true);
    expect(sentinelSchema.safeParse({ reason: "no secrets", status: "UNSAFE" }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(sentinelSchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
  });
});

describe("aiSchema", () => {
  const minimal = {
    executive_summary: { architecture_style: "Layered", purpose: "p", stack_details: [] },
    onboarding_guide: { prerequisites: [], setup_steps: [] },
    refactoring_targets: [],
    sections: {
      api_structure: "REST",
      data_flow: "flow",
      security_audit: { risks: [], score: 5 },
    },
  };

  it("accepts a minimal valid generation result", () => {
    expect(aiSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects a security audit score outside the 0-10 range", () => {
    const parsed = aiSchema.safeParse({
      ...minimal,
      sections: { ...minimal.sections, security_audit: { risks: [], score: 20 } },
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a missing sections block", () => {
    const { sections: _sections, ...withoutSections } = minimal;
    expect(aiSchema.safeParse(withoutSections).success).toBe(false);
  });

  it("rejects an invalid finding severity enum value", () => {
    const parsed = aiSchema.safeParse({
      ...minimal,
      findings: [{ id: "f1", severity: "EXTREME", title: "T" }],
    });

    expect(parsed.success).toBe(false);
  });
});
