import { describe, expect, it } from "vitest";

import type { RepositoryFact } from "@/server/utils/types";

import type { ProjectMap } from "../engine/core/analysis-result.schemas";
import type { DocumentationInputModel } from "../engine/core/documentation.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import {
  type ArchitectDigest,
  buildArchitectDigest,
  collectArchitectPreferredPaths,
} from "./architect-digest";

const makeDocInput = (): DocumentationInputModel =>
  ({
    sections: {
      api_reference: {
        body: {
          frameworkFacts: [
            { category: "framework", confidence: 0.9, name: "React", sources: ["api/a.ts"] },
          ],
          publicSurfacePaths: ["api/pub.ts"],
          routeInventory: {
            estimatedOperations: 4,
            httpRoutes: [{ method: "GET", path: "/users", sourcePath: "api/a.ts" }],
            sourceFiles: ["api/a.ts", "api/b.ts"],
          },
          sourceOfTruth: "file",
        },
        confidence: "high",
        evidencePaths: ["api/a.ts"],
        summary: ["api summary"],
        title: "API",
        unknowns: ["u1"],
      },
      architecture: {
        body: {
          dependencyCycles: ["a", "b"],
          dependencyHotspots: [{ inbound: 1, outbound: 2, path: "dep.ts" }],
          graphReliability: { resolvedEdges: 7, unresolvedImportSpecifiers: 1 },
          modules: [{ apiSurface: 2, categories: ["runtime-source"], exports: 3, path: "src/x" }],
          orphanModules: ["o.ts"],
          primaryEntrypoints: ["e.ts"],
        },
        confidence: "high",
        evidencePaths: ["src/x"],
        summary: [],
        title: "",
        unknowns: [],
      },
      onboarding: {
        body: {
          apiPaths: ["api/a.ts"],
          configPaths: ["c.json"],
          firstLookPaths: ["e.ts"],
          newcomerSteps: ["read code"],
          riskPaths: ["r.ts"],
        },
        confidence: "high",
        evidencePaths: [],
        summary: [],
        title: "",
        unknowns: [],
      },
      overview: {
        body: {
          configFiles: ["c.json"],
          primaryEntrypoints: ["e.ts"],
          primaryModules: ["src/x"],
          repositoryKind: "app",
          stackProfile: ["TypeScript"],
        },
        confidence: "high",
        evidencePaths: [],
        summary: [],
        title: "",
        unknowns: [],
      },
      risks: {
        body: {
          derivedScores: { risk: 5 },
          findings: [
            {
              evidence: [{ path: "src/x" }],
              id: "f1",
              score: 9,
              severity: "high",
              summary: "first",
              title: "Finding 1",
            },
          ],
          hotspots: [{ path: "hot.ts", score: 5 }],
          rawMetrics: { complexity: 3 },
        },
        confidence: "high",
        evidencePaths: [],
        summary: [],
        title: "",
        unknowns: [],
      },
    },
  }) as unknown as DocumentationInputModel;

const makeMetrics = (): RepoMetrics =>
  ({
    analysisCoverage: {
      heuristicFiles: 10,
      parserCoveragePercent: 50,
      totalFiles: 20,
      treeSitterFiles: 8,
      typeScriptAstFiles: 6,
    },
    apiSurface: 3,
    changeCoupling: [{ commits: 2, fromPath: "a.ts", toPath: "b.ts" }],
    churnHotspots: [{ commitsInWindow: 4, path: "hot.ts" }],
    complexityScore: 5,
    dependencyHotspots: [],
    duplicationReport: { duplicationPercentage: 12.5 },
    graphReliability: { resolvedEdges: 7, unresolvedImportSpecifiers: 1 },
    languages: [{ name: "TypeScript" }, { name: "JavaScript" }],
    onboardingScore: 3,
    orphanModules: [],
    publicExports: 42,
    securityScore: 6,
    techDebtScore: 7,
    techStack: ["TypeScript"],
    totalLoc: 1234,
  }) as unknown as RepoMetrics;

const makeProjectMap = (): ProjectMap =>
  ({
    language_breakdown: [{ name: "TypeScript", percentage: 100 }],
    modules: [
      {
        dependencies: [
          "lodash",
          "react",
          "react-dom",
          "zod",
          "x",
          "y",
          "z",
          "w",
          "v",
          "u",
          "t",
          "s",
          "r",
          "q",
          "p",
          "o",
          "n",
        ],
        path: "src/x",
        responsibility: "handles X",
        type: "module",
      },
    ],
    overview: "A test platform",
  }) as unknown as ProjectMap;

describe("buildArchitectDigest", () => {
  it("maps facts/findings, metrics and documentation sections", () => {
    const digest = buildArchitectDigest(
      makeDocInput(),
      makeMetrics(),
      makeProjectMap(),
      [
        {
          category: "architecture",
          confidence: "high",
          detail: "Exhaustive technical detail",
          evidence: [{ path: "src/x" }, { path: "src/x" }, { path: "other.ts" }],
          id: "fact-1",
          title: "Fact 1",
        },
      ],
      [
        {
          category: "maintainability",
          confidence: 0.9,
          evidence: [{ path: "src/x" }],
          id: "finding-1",
          score: 4,
          severity: "MODERATE",
          suggestedNextChange: "Refactor module",
          summary: "summary",
          title: "Finding 1",
          whyItMatters: "Maintainability risk",
        },
      ],
    );

    expect(digest.facts).toEqual([
      {
        category: "architecture",
        confidence: "high",
        evidencePaths: ["src/x", "other.ts"],
        id: "fact-1",
        title: "Fact 1",
      },
    ]);
    expect(digest.findings).toEqual([
      {
        category: "maintainability",
        evidencePaths: ["src/x"],
        id: "finding-1",
        score: 4,
        severity: "MODERATE",
        summary: "summary",
        title: "Finding 1",
      },
    ]);
    expect(digest.metrics).toEqual(
      expect.objectContaining({
        duplicationPercentage: 12.5,
        languages: ["TypeScript", "JavaScript"],
        publicExports: 42,
        totalLoc: 1234,
      }),
    );
    expect(digest.sections.api_reference).toEqual(
      expect.objectContaining({
        estimatedOperations: 4,
        routeSource: "file",
        routeSourceFiles: ["api/a.ts", "api/b.ts"],
        sampleRoutes: [{ method: "GET", path: "/users", sourcePath: "api/a.ts" }],
      }),
    );
    expect(digest.sections.architecture).toEqual(
      expect.objectContaining({
        dependencyCycles: 2,
        dependencyHotspots: [{ inbound: 1, outbound: 2, path: "dep.ts" }],
        modules: [{ apiSurface: 2, categories: ["runtime-source"], exports: 3, path: "src/x" }],
        primaryEntrypoints: ["e.ts"],
      }),
    );
    expect(digest.sections.overview.repositoryKind).toBe("app");
    expect(digest.sections.risks.findings).toEqual([
      {
        evidencePaths: ["src/x"],
        id: "f1",
        score: 9,
        severity: "high",
        summary: "first",
        title: "Finding 1",
      },
    ]);
    expect(digest.projectMap.modules[0]?.dependencies).toHaveLength(15);
    expect(digest.projectMap.overview).toBe("A test platform");
  });

  it("caps facts and findings at 30", () => {
    const facts = Array.from(
      { length: 35 },
      (_, index): RepositoryFact => ({
        category: "architecture" as const,
        confidence: "high",
        detail: "d",
        evidence: [],
        id: `f${index}`,
        title: `Fact ${index}`,
      }),
    );

    const digest = buildArchitectDigest(makeDocInput(), makeMetrics(), makeProjectMap(), facts, []);

    expect(digest.facts).toHaveLength(30);
  });
});

describe("collectArchitectPreferredPaths", () => {
  const makeDigest = (overrides: Partial<ArchitectDigest> = {}): ArchitectDigest =>
    ({
      facts: [
        {
          category: "architecture",
          confidence: 0.9,
          evidencePaths: ["dup-a"],
          id: "f",
          title: "F",
        },
      ],
      findings: [
        {
          category: "bug",
          evidencePaths: ["dup-a"],
          id: "r",
          score: 5,
          severity: "high",
          summary: "s",
          title: "R",
        },
      ],
      metrics: {} as ArchitectDigest["metrics"],
      projectMap: { languageBreakdown: [], modules: [], overview: "" },
      sections: {
        api_reference: { publicSurfacePaths: ["pub.ts"], routeSourceFiles: ["dup-a"] } as never,
        architecture: { modules: [{ path: "mod.ts" }], orphanModules: ["orphan.ts"] } as never,
        onboarding: { apiPaths: [], configPaths: [], firstLookPaths: ["first.ts"] } as never,
        overview: { primaryEntrypoints: ["e.ts"], primaryModules: [] } as never,
        risks: { hotspots: [{ path: "hot.ts", score: 3 }] } as never,
      },
      ...overrides,
    }) as ArchitectDigest;

  it("orders and deduplicates preferred paths", () => {
    const paths = collectArchitectPreferredPaths(makeDigest());

    expect(paths).toEqual(["e.ts", "mod.ts", "orphan.ts", "dup-a", "pub.ts", "hot.ts", "first.ts"]);
  });

  it("caps the result at 200 paths", () => {
    const many = Array.from({ length: 220 }, (_, index) => `file-${index}.ts`);
    const paths = collectArchitectPreferredPaths(
      makeDigest({
        sections: {
          api_reference: { publicSurfacePaths: [], routeSourceFiles: [] } as never,
          architecture: { modules: [], orphanModules: [] } as never,
          onboarding: { apiPaths: [], configPaths: [], firstLookPaths: [] } as never,
          overview: { primaryEntrypoints: many, primaryModules: [] } as never,
          risks: { hotspots: [] } as never,
        },
      }),
    );

    expect(paths).toHaveLength(200);
  });
});
