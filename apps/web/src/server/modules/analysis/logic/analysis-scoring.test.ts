import { describe, expect, it } from "vitest";

import {
  buildFinalMetrics,
  buildResultToStore,
  computeHealthScore,
  computeOnboardingScore,
} from "./analysis-scoring";

type RepoMetrics = Parameters<typeof computeOnboardingScore>[0]["hardMetrics"];
type AIResult = Parameters<typeof buildResultToStore>[0]["aiResult"];

const NOW = new Date("2026-01-15T00:00:00.000Z");

function metrics(overrides: Partial<RepoMetrics> = {}): RepoMetrics {
  return {
    complexityScore: 42,
    configFiles: 0,
    dependencyCycles: [],
    docDensity: 0,
    duplicationReport: { clones: [], duplicationPercentage: 3, totalDuplicatedLines: 0 },
    entrypoints: [],
    mostComplexFiles: [],
    securityFindings: [],
    securityScore: 80,
    techDebtScore: 20,
    ...overrides,
  } as unknown as RepoMetrics;
}

function repo(overrides: Record<string, unknown> = {}) {
  return { pushedAt: NOW, updatedAt: NOW, ...overrides } as never;
}

function aiResult(overrides: Partial<AIResult> = {}): AIResult {
  return { ...overrides } as AIResult;
}

const FACT = {
  category: "architecture",
  confidence: "high",
  detail: "d",
  evidence: [],
  id: "f1",
  title: "t",
};

describe("computeOnboardingScore", () => {
  it("awards nothing for an empty repository", () => {
    expect(
      computeOnboardingScore({ docOutputScore: 0, hardMetrics: metrics(), repositoryFacts: [] }),
    ).toBe(0);
  });

  it("adds the entrypoint bonus only when entrypoints exist", () => {
    const withEntrypoints = computeOnboardingScore({
      docOutputScore: 0,
      hardMetrics: metrics({ entrypoints: ["src/index.ts"] as never }),
      repositoryFacts: [],
    });

    expect(withEntrypoints).toBe(15);
  });

  it("adds the config-file bonus only when config files exist", () => {
    expect(
      computeOnboardingScore({
        docOutputScore: 0,
        hardMetrics: metrics({ configFiles: 3 }),
        repositoryFacts: [],
      }),
    ).toBe(10);
  });

  it("awards the doc-density bonus only above the threshold", () => {
    const atThreshold = computeOnboardingScore({
      docOutputScore: 0,
      hardMetrics: metrics({ docDensity: 10 }),
      repositoryFacts: [],
    });
    const aboveThreshold = computeOnboardingScore({
      docOutputScore: 0,
      hardMetrics: metrics({ docDensity: 11 }),
      repositoryFacts: [],
    });

    expect(atThreshold).toBe(0);
    expect(aboveThreshold).toBe(10);
  });

  it("awards the architecture bonus for an architecture fact only", () => {
    expect(
      computeOnboardingScore({
        docOutputScore: 0,
        hardMetrics: metrics(),
        repositoryFacts: [FACT] as never,
      }),
    ).toBe(10);

    expect(
      computeOnboardingScore({
        docOutputScore: 0,
        hardMetrics: metrics(),
        repositoryFacts: [{ ...FACT, category: "security" }] as never,
      }),
    ).toBe(0);
  });

  it("sums every bonus on top of the doc output score", () => {
    expect(
      computeOnboardingScore({
        docOutputScore: 30,
        hardMetrics: metrics({
          configFiles: 1,
          docDensity: 50,
          entrypoints: ["src/index.ts"] as never,
        }),
        repositoryFacts: [FACT] as never,
      }),
    ).toBe(30 + 10 + 15 + 10 + 10);
  });

  it("caps the total at 100", () => {
    expect(
      computeOnboardingScore({
        docOutputScore: 99,
        hardMetrics: metrics({
          configFiles: 1,
          docDensity: 50,
          entrypoints: ["src/index.ts"] as never,
        }),
        repositoryFacts: [FACT] as never,
      }),
    ).toBe(100);
  });
});

describe("computeHealthScore", () => {
  // The scoring formula itself is covered by engine/metrics/complexity.test.ts.
  // What matters here is that this wrapper converts `dependencyCycles` to a
  // count and forwards the remaining measured fields unchanged.
  //
  // Expected value derived by hand from MODERN_HEALTH_SCORE's published weights
  // (a repo pushed long ago earns no recency bonus):
  //   security 70*.24 = 16.8 | techDebt 30*.20 = 6.0 | complexity 11*.16 = 1.76
  //   duplication (100-9*2)*.12 = 9.84 | docs (5*4)*.08 = 1.6
  //   busFactor (4*18)*.10 = 7.2 | cycles (100-2*18)*.10 = 6.4
  //   total 49.6 -> 50
  it("counts dependency cycles and forwards the measured fields", () => {
    const hardMetrics = metrics({
      complexityScore: 11,
      dependencyCycles: ["a", "b"] as never,
      docDensity: 5,
      duplicationReport: { clones: [], duplicationPercentage: 9, totalDuplicatedLines: 40 },
      securityScore: 70,
      techDebtScore: 30,
    });

    expect(
      computeHealthScore({
        busFactor: 4,
        hardMetrics,
        repo: repo({ pushedAt: new Date("2024-01-01T00:00:00.000Z") }),
      }),
    ).toBe(50);
  });

  // Best case without a recency bonus: every weighted component at its maximum.
  //   security 100*.24 = 24 | duplication 100*.12 = 12 | docs 100*.08 = 8
  //   busFactor 100*.10 = 10 | cycles 100*.10 = 10 | techDebt/complexity 0
  //   total 64 (the weights only reach 64 because techDebt and complexity are 0)
  it("scores an otherwise perfect long-idle repository at 64", () => {
    const hardMetrics = metrics({
      complexityScore: 0,
      dependencyCycles: [] as never,
      docDensity: 25,
      duplicationReport: { clones: [], duplicationPercentage: 0, totalDuplicatedLines: 0 },
      securityScore: 100,
      techDebtScore: 0,
    });

    expect(
      computeHealthScore({
        busFactor: 10,
        hardMetrics,
        repo: repo({ pushedAt: new Date("2024-01-01T00:00:00.000Z") }),
      }),
    ).toBe(64);
  });
});

describe("buildResultToStore", () => {
  it("overrides the AI result with the measured hard metrics", () => {
    const result = buildResultToStore({
      aiResult: aiResult({ complexityScore: 1, securityScore: 1, techDebtScore: 1 }),
      hardMetrics: metrics({ complexityScore: 55, securityScore: 66, techDebtScore: 77 }),
      onboardingScore: 40,
      repositoryFacts: [FACT] as never,
      repositoryFindings: [{ id: "x" }] as never,
    });

    expect(result.complexityScore).toBe(55);
    expect(result.securityScore).toBe(66);
    expect(result.techDebtScore).toBe(77);
    expect(result.onboardingScore).toBe(40);
    expect(result.repository_facts).toEqual([FACT]);
  });

  it("preserves unrelated AI result fields", () => {
    const result = buildResultToStore({
      aiResult: aiResult({
        executive_summary: {
          architecture_style: "modular",
          purpose: "kept",
          stack_details: ["bun"],
        },
      }),
      hardMetrics: metrics(),
      onboardingScore: 0,
      repositoryFacts: [],
      repositoryFindings: [],
    });

    expect(result.executive_summary.purpose).toBe("kept");
  });

  it("maps scanner security findings to vulnerabilities", () => {
    const result = buildResultToStore({
      aiResult: aiResult(),
      hardMetrics: metrics({
        securityFindings: [
          { line: 12, message: "hardcoded token", path: "src/a.ts", severity: "error" },
          { line: null, message: "weak hash", path: "src/b.ts", severity: "warning" },
        ] as never,
      }),
      onboardingScore: 0,
      repositoryFacts: [],
      repositoryFindings: [],
    });

    expect(result.vulnerabilities).toEqual([
      {
        description: "hardcoded token",
        file: "src/a.ts",
        lineHint: "line 12",
        risk: "HIGH",
        suggestion:
          "Review the flagged secret-like value and replace it with a safe managed secret.",
      },
      {
        description: "weak hash",
        file: "src/b.ts",
        lineHint: undefined,
        risk: "MODERATE",
        suggestion:
          "Review the flagged secret-like value and replace it with a safe managed secret.",
      },
    ]);
  });

  it("leaves lineHint undefined when the finding has no line", () => {
    const result = buildResultToStore({
      aiResult: aiResult(),
      hardMetrics: metrics({
        securityFindings: [{ line: null, message: "m", path: "p", severity: "warning" }] as never,
      }),
      onboardingScore: 0,
      repositoryFacts: [],
      repositoryFindings: [],
    });

    expect(result.vulnerabilities?.[0]?.lineHint).toBeUndefined();
  });
});

describe("buildFinalMetrics", () => {
  it("overrides counts, scores and the derived maintenance status", () => {
    const result = buildFinalMetrics({
      busFactor: 3,
      factCount: 7,
      finalHealthScore: 64,
      findingCount: 9,
      hardMetrics: metrics({ busFactor: 0, factCount: 0, findingCount: 0 }),
      onboardingScore: 50,
      repo: repo(),
      teamRoles: [{ login: "a", role: "core", share: 1 }] as never,
    });

    expect(result.busFactor).toBe(3);
    expect(result.factCount).toBe(7);
    expect(result.findingCount).toBe(9);
    expect(result.healthScore).toBe(64);
    expect(result.onboardingScore).toBe(50);
    expect(result.teamRoles).toEqual([{ login: "a", role: "core", share: 1 }]);
  });

  // The active/stale/dead boundaries are covered by analysis.utils.test.ts. Here we
  // only pin that the status is derived from the repo and lands on the metrics payload.
  it("derives the maintenance status from the repo", () => {
    const result = buildFinalMetrics({
      busFactor: 1,
      factCount: 0,
      finalHealthScore: 0,
      findingCount: 0,
      hardMetrics: metrics(),
      onboardingScore: 0,
      repo: repo({ pushedAt: new Date() }),
      teamRoles: [],
    });

    expect(result.maintenanceStatus).toBe("active");
  });

  it("carries every untouched hard metric through", () => {
    const result = buildFinalMetrics({
      busFactor: 1,
      factCount: 0,
      finalHealthScore: 0,
      findingCount: 0,
      hardMetrics: metrics({ complexityScore: 31, totalLoc: 5000 }),
      onboardingScore: 0,
      repo: repo(),
      teamRoles: [],
    });

    expect(result.complexityScore).toBe(31);
    expect(result.totalLoc).toBe(5000);
  });
});
