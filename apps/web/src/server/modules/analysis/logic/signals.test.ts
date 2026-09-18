import { describe, expect, it } from "vitest";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { collectScopedEntrySignals, collectScopedSignals } from "./signals";

const makeMetrics = (overrides: Partial<RepoMetrics> = {}): RepoMetrics =>
  ({
    changeCoupling: [],
    churnHotspots: [],
    dependencyHotspots: [],
    orphanModules: [],
    ...overrides,
  }) as unknown as RepoMetrics;

const makeAiResult = (overrides: Partial<AIResult> = {}): AIResult =>
  ({ findings: [], repository_facts: [], ...overrides }) as unknown as AIResult;

describe("collectScopedEntrySignals", () => {
  const paths = ["src/a.ts", "src/b.ts"];

  it("collects signals matching the selected paths", () => {
    const metrics = makeMetrics({
      changeCoupling: [
        { commits: 9, fromPath: "src/a.ts", toPath: "src/b.ts" },
        { commits: 2, fromPath: "src/a.ts", toPath: "lib/x.ts" },
        { commits: 7, fromPath: "other/c.ts", toPath: "other/d.ts" },
      ],
      churnHotspots: [
        { churnScore: 5, commitsInWindow: 5, path: "src/b.ts" },
        { churnScore: 1, commitsInWindow: 1, path: "unrelated.ts" },
      ],
      dependencyHotspots: [
        { exports: 4, inbound: 1, outbound: 1, path: "src/a.ts" },
        { exports: 1, inbound: 1, outbound: 1, path: "ignored.ts" },
      ],
      frameworkFacts: [
        { category: "framework", confidence: 0.9, name: "React", sources: ["src/a.ts"] },
        { category: "framework", confidence: 0.5, name: "Svelte", sources: ["unknown.ts"] },
      ],
      graphPreviewEdges: [{ fromPath: "src/a.ts", toPath: "src/neighbor.ts", weight: 2 }],
      graphReliability: {
        resolvedEdges: 10,
        unresolvedImportSpecifiers: 1,
        unresolvedSamples: [{ fromPath: "src/b.ts", specifier: "pkg" }],
      },
      hotspotSignals: [
        {
          categories: ["runtime-source"],
          churnScore: 2,
          complexity: 3,
          confidence: 88,
          inbound: 1,
          outbound: 1,
          path: "src/a.ts",
          score: 8,
          source: "risk-model",
        },
      ],
      orphanModules: ["src/a.ts", "zzz/orphan.ts"],
    });

    const result = collectScopedEntrySignals(paths, {
      aiResult: makeAiResult({
        repository_facts: [
          {
            category: "architecture",
            confidence: "high",
            detail: "Exhaustive technical detail",
            evidence: [{ path: "src/a.ts" }],
            id: "fact-a",
            title: "Fact A",
          },
        ],
      }),
      metrics,
    });

    expect(result.changeCoupling).toEqual([
      expect.objectContaining({ commits: 9, fromPath: "src/a.ts", toPath: "src/b.ts" }),
      expect.objectContaining({ commits: 2, fromPath: "src/a.ts", toPath: "lib/x.ts" }),
    ]);
    expect(result.churnHotspots).toEqual([
      expect.objectContaining({ commitsInWindow: 5, path: "src/b.ts" }),
    ]);
    expect(result.dependencyHotspots).toEqual([expect.objectContaining({ path: "src/a.ts" })]);
    expect(result.frameworkNames).toEqual(["React"]);
    expect(result.graphNeighborPaths).toEqual(["src/neighbor.ts"]);
    expect(result.graphUnresolvedSamples).toEqual([
      expect.objectContaining({ fromPath: "src/b.ts", specifier: "pkg" }),
    ]);
    expect(result.hotspotSignals).toEqual([
      expect.objectContaining({ path: "src/a.ts", score: 8 }),
    ]);
    expect(result.orphanPaths).toEqual(["src/a.ts"]);
    expect(result.factTitles).toEqual(["Fact A"]);
  });

  it("sorts hotspots by score and caps the slices", () => {
    const metrics = makeMetrics({
      hotspotSignals: Array.from({ length: 6 }, (_, index) => ({
        categories: [],
        churnScore: 1,
        complexity: 1,
        confidence: 88,
        inbound: 0,
        outbound: 0,
        path: `hot/${index}.ts`,
        score: index,
        source: "risk-model",
      })),
    });

    const result = collectScopedEntrySignals(
      ["hot/0.ts", "hot/1.ts", "hot/2.ts", "hot/3.ts", "hot/4.ts", "hot/5.ts"],
      {
        aiResult: makeAiResult(),
        metrics,
      },
    );

    expect(result.hotspotSignals).toHaveLength(4);
    expect(result.hotspotSignals[0]?.path).toBe("hot/5.ts");
  });
});

describe("collectScopedSignals", () => {
  it("returns facts and findings with evidence in paths", () => {
    const aiResult = makeAiResult({
      findings: [
        {
          category: "bug",
          evidence: [{ path: "src/b.ts" }],
          severity: "high",
          title: "Finding 1",
        } as never,
      ],
      repository_facts: [
        {
          category: "architecture",
          confidence: "high",
          detail: "Exhaustive technical detail",
          evidence: [{ path: "src/a.ts" }],
          id: "fact-1",
          title: "Fact 1",
        },
        {
          category: "architecture",
          confidence: "high",
          detail: "Exhaustive technical detail",
          evidence: [{ path: "other/z.ts" }],
          id: "fact-2",
          title: "Fact 2",
        },
      ],
    });

    const result = collectScopedSignals(["src/a.ts", "src/b.ts"], { aiResult });

    expect(result.facts.map((fact) => fact.title)).toEqual(["Fact 1"]);
    expect(result.findings.map((finding) => finding.title)).toEqual(["Finding 1"]);
  });
});
