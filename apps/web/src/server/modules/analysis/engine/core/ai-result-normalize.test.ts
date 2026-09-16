import { describe, expect, it } from "vitest";

import {
  isSchemaMismatchError,
  normalizeAiGenerationOutput,
  normalizeProjectMapOutput,
} from "./ai-result-normalize";

describe("normalizeAiGenerationOutput", () => {
  it("normalizes a complete raw payload into a typed AI result", () => {
    const result = normalizeAiGenerationOutput({
      analysisRuntime: { architect: { source: "llm", status: "success" } },
      complexityScore: 20,
      executive_summary: {
        architecture_style: "Hexagonal",
        key_innovations: ["typed RPC"],
        purpose: "Automate repository intelligence",
        stack_details: ["TypeScript"],
      },
      findings: [
        {
          category: "security",
          confidence: 90,
          evidence: [{ line: 2.9, path: "src/app.ts" }],
          id: "f1",
          score: 88,
          severity: "CRITICAL",
          summary: "Exposed token",
          title: "Leaked secret",
          whyItMatters: "Production compromise risk",
        },
      ],
      onboarding_guide: { prerequisites: ["node"], setup_steps: ["bun install"] },
      refactoring_targets: [{ description: "Split module", file: "src/b.ts", priority: "HIGH" }],
      repository_facts: [
        { category: "architecture", confidence: "high", detail: "Hono RPC", id: "r1", title: "R1" },
      ],
      sections: {
        api_structure: "REST",
        data_flow: "Request-response",
        infrastructure_and_scaling: {
          bottlenecks: ["single db"],
          concurrency_risks: [],
          statelessness_check: "ok",
        },
        performance_audit: [
          {
            impact: "slow",
            issue: "N+1 query",
            location: "src/a.ts",
            optimization_strategy: "batch",
          },
        ],
        security_audit: { attack_surface_analysis: "public api", risks: ["xss"], score: 7 },
        tech_debt_inventory: [
          { description: "Monolith", remediation_effort: "HIGH", type: "ARCHITECTURAL_ISSUE" },
        ],
      },
      securityScore: 10,
      techDebtScore: 5,
      vulnerabilities: [
        { description: "SQLi", file: "src/a.ts", risk: "HIGH", suggestion: "use params" },
      ],
    });

    expect(result.executive_summary).toEqual({
      architecture_style: "Hexagonal",
      key_innovations: ["typed RPC"],
      purpose: "Automate repository intelligence",
      stack_details: ["TypeScript"],
    });
    expect(result.findings?.[0]).toMatchObject({
      id: "f1",
      score: 88,
      severity: "CRITICAL",
      title: "Leaked secret",
    });
    expect(result.findings?.[0]?.evidence[0]?.line).toBe(2);
    expect(result.refactoring_targets[0]).toMatchObject({ file: "src/b.ts", priority: "HIGH" });
    expect(result.repository_facts?.[0]).toMatchObject({ confidence: "high", id: "r1" });
    expect(result.sections.security_audit.score).toBe(7);
    expect(result.sections.security_audit.risks).toEqual(["xss"]);
    expect(result.sections.tech_debt_inventory?.[0]?.type).toBe("ARCHITECTURAL_ISSUE");
    expect(result.vulnerabilities?.[0]?.risk).toBe("HIGH");
    expect(result.complexityScore).toBe(20);
  });

  it("fills defaults for missing optional sections", () => {
    const result = normalizeAiGenerationOutput({});

    expect(result.executive_summary).toEqual({
      architecture_style: "Layered application architecture",
      key_innovations: [],
      purpose: "Automated repository intelligence report",
      stack_details: [],
    });
    expect(result.onboarding_guide).toEqual({ prerequisites: [], setup_steps: [] });
    expect(result.sections.api_structure).toBe("API surface documented from static scan.");
    expect(result.sections.security_audit.score).toBe(5);
    expect(result.findings).toEqual([]);
  });

  it("clamps security audit and finding scores into their valid ranges", () => {
    const result = normalizeAiGenerationOutput({
      findings: [{ confidence: -10, id: "f1", score: 150, severity: "LOW" }],
      sections: { security_audit: { risks: [], score: 300 } },
    });

    expect(result.findings?.[0]?.confidence).toBe(0);
    expect(result.findings?.[0]?.score).toBe(100);
    expect(result.sections.security_audit.score).toBe(10);
  });

  it("falls back to an empty partial result when the payload cannot be validated", () => {
    const result = normalizeAiGenerationOutput({
      executive_summary: { purpose: "kept" },
      findings: [{ effort_to_fix: "WEIRD", id: "f1", severity: "LOW" }],
    });

    expect(result.findings).toEqual([]);
    expect(result.refactoring_targets).toEqual([]);
    expect(result.repository_facts).toEqual([]);
    expect(result.executive_summary.purpose).toBe("kept");
  });
});

describe("normalizeProjectMapOutput", () => {
  it("normalizes modules, decisions, language breakdown, and overview", () => {
    const result = normalizeProjectMapOutput({
      key_decisions: ["Adopt Hono"],
      language_breakdown: { frameworks: ["Hono"], primary: "TypeScript" },
      mermaid_graph: "graph TD",
      modules: [
        {
          churn_score: 3,
          complexity_index: 42,
          dependencies: ["src/util.ts"],
          path: "src/app.ts",
          publicExports: ["run"],
          responsibility: "App entry",
          type: "module",
        },
        { path: "", responsibility: "invalid", type: "module" },
      ],
      overview: "Topology",
    });

    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]).toEqual({
      churn_score: 3,
      complexity_index: 42,
      dependencies: ["src/util.ts"],
      external_integrations: [],
      path: "src/app.ts",
      publicExports: ["run"],
      responsibility: "App entry",
      type: "module",
    });
    expect(result.key_decisions?.[0]).toEqual({
      consequences: "Impacts module boundaries and maintenance strategy.",
      decision: "Adopt Hono",
      rationale: "Inferred from repository topology.",
    });
    expect(result.language_breakdown).toMatchObject({
      frameworks: ["Hono"],
      primary: "TypeScript",
    });
    expect(result.mermaid_graph).toBe("graph TD");
    expect(result.overview).toBe("Topology");
  });

  it("uses defaults when the raw input is empty", () => {
    const result = normalizeProjectMapOutput({});

    expect(result.overview).toBe("Repository topology map");
    expect(result.modules).toEqual([]);
    expect(result.mermaid_graph).toBeUndefined();
    expect(result.key_decisions).toBeUndefined();
    expect(result.language_breakdown).toBeUndefined();
  });

  it("extracts an embedded project map from the overview text", () => {
    const result = normalizeProjectMapOutput({
      overview:
        'Architecture overview, "modules":[{"path":"src/app.ts","responsibility":"Entry","type":"module"}]',
    });

    expect(result.overview).toBe("Architecture overview");
    expect(result.modules.map((module) => module.path)).toEqual(["src/app.ts"]);
  });
});

describe("isSchemaMismatchError", () => {
  it("recognizes schema mismatch error signatures", () => {
    expect(isSchemaMismatchError(new Error("Output did not match schema for object"))).toBe(true);
    expect(isSchemaMismatchError(new Error("No object generated"))).toBe(true);

    const aiError = new Error("boom");
    aiError.name = "AI_NoObjectGeneratedError";
    expect(isSchemaMismatchError(aiError)).toBe(true);
  });

  it("rejects unrelated errors and non-error values", () => {
    expect(isSchemaMismatchError(new Error("disk full"))).toBe(false);
    expect(isSchemaMismatchError(new SyntaxError("bad json"))).toBe(false);
    expect(isSchemaMismatchError(new TypeError("nope"))).toBe(false);
    expect(isSchemaMismatchError("did not match schema")).toBe(false);
    expect(isSchemaMismatchError(undefined)).toBe(false);
    expect(isSchemaMismatchError({})).toBe(false);
  });
});
