import { describe, expect, it } from "vitest";

import { projectResultOverview } from "./project-result-overview";

const fullResult = {
  complexityScore: 61,
  executive_summary: {
    architecture_style: "Layered modular monolith",
    purpose: "Analyze pull requests without reading the whole repository.",
    stack_details: ["TypeScript", "Next.js", "Postgres"],
  },
  findings: [
    {
      evidence: [{ path: "src/a.ts" }],
      severity: "HIGH",
      summary: "Unbounded list payload",
      title: "Unbounded list",
    },
    {
      evidence: [{ path: "src/b.ts" }],
      severity: "LOW",
      summary: "Missing index",
      title: "Missing index",
    },
  ],
  mainBottlenecks: ["dashboard aggregate", "cold start"],
  mostComplexFiles: ["src/server/core/db.ts", "src/app/page.tsx"],
  onboardingScore: 44,
  repository_facts: [{ title: "f1" }, { title: "f2" }, { title: "f3" }],
  securityScore: 72,
  techDebtScore: 33,
  vulnerabilities: [{ file: "src/s.sql", risk: "HIGH" }],
};

describe("projectResultOverview", () => {
  it("returns an empty JSON object for any unknown shape instead of throwing", () => {
    const unknownInputs: unknown[] = [
      undefined,
      null,
      42,
      "not json",
      [1, 2, 3],
      {},
      () => undefined,
    ];

    for (const input of unknownInputs) {
      expect(projectResultOverview(input)).toBe("{}");
    }
  });

  it("projects a bounded summary of a full result", () => {
    const parsed = JSON.parse(projectResultOverview(fullResult)) as Record<string, unknown>;

    expect(parsed).toStrictEqual({
      architecture_style: "Layered modular monolith",
      counts: {
        findings: 2,
        mostComplexFiles: 2,
        repositoryFacts: 3,
        vulnerabilities: 1,
      },
      mainBottlenecks: ["dashboard aggregate", "cold start"],
      mostComplexFiles: ["src/server/core/db.ts", "src/app/page.tsx"],
      purpose: "Analyze pull requests without reading the whole repository.",
      scores: {
        complexityScore: 61,
        onboardingScore: 44,
        securityScore: 72,
        techDebtScore: 33,
      },
      stack: ["TypeScript", "Next.js", "Postgres"],
      topFindings: [
        {
          description: "Unbounded list payload",
          file: "src/a.ts",
          risk: "HIGH",
          title: "Unbounded list",
        },
        { description: "Missing index", file: "src/b.ts", risk: "LOW", title: "Missing index" },
      ],
      topVulnerabilities: [{ file: "src/s.sql", risk: "HIGH" }],
    });
  });

  it("keeps missing scalars null and absent arrays empty", () => {
    const parsed = JSON.parse(projectResultOverview({ findings: "nope" })) as Record<
      string,
      unknown
    >;

    expect(parsed).toStrictEqual({
      architecture_style: null,
      counts: { findings: 0, mostComplexFiles: 0, repositoryFacts: 0, vulnerabilities: 0 },
      mainBottlenecks: [],
      mostComplexFiles: [],
      purpose: "",
      scores: {
        complexityScore: null,
        onboardingScore: null,
        securityScore: null,
        techDebtScore: null,
      },
      stack: [],
      topFindings: [],
      topVulnerabilities: [],
    });
  });

  it("caps a ~1 MB result at 4096 characters without breaking the JSON", () => {
    const bigResult = {
      complexityScore: 90,
      executive_summary: {
        architecture_style: "x".repeat(20_000),
        purpose: "p".repeat(400_000),
        stack_details: Array.from(
          { length: 200 },
          (_, index) => `stack-${index}-${"s".repeat(500)}`,
        ),
      },
      findings: Array.from({ length: 5000 }, (_, index) => ({
        evidence: [{ path: `src/file-${index}-${"e".repeat(100)}.ts` }],
        severity: "HIGH",
        summary: "d".repeat(2000),
        title: "t".repeat(2000),
      })),
      mainBottlenecks: Array.from(
        { length: 500 },
        (_, index) => `bottleneck-${index}-${"b".repeat(200)}`,
      ),
      mostComplexFiles: Array.from(
        { length: 500 },
        (_, index) => `file-${index}-${"f".repeat(200)}`,
      ),
      vulnerabilities: Array.from({ length: 3000 }, (_, index) => ({
        file: `src/v-${index}-${"v".repeat(200)}.sql`,
        risk: "CRITICAL",
      })),
    };

    expect(JSON.stringify(bigResult).length).toBeGreaterThan(1_000_000);

    const overview = projectResultOverview(bigResult);

    expect(overview.length).toBeLessThanOrEqual(4096);
    expect(() => JSON.parse(overview)).not.toThrow();
  });
});
