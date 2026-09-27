import { uniq } from "es-toolkit";
import { normalize } from "pathe";
import { describe, expect, it } from "vitest";

import { analysisMapper } from "./analysis.mapper";
import type { AnalysisRef } from "./analysis.repository";
import { type NodeContextOutput, NodeContextOutputSchema } from "./analysis.schemas";
import type { AIResult } from "./engine/core/analysis-result.schemas";
import type { RepoMetrics } from "./engine/core/metrics.types";
import { fixesMapper, type GeneratedFixSummaryRecord } from "./fixes.mapper";
import { buildInteractiveBriefNodePayload } from "./logic/brief";
import { matchDocSections } from "./logic/doc-section-matcher";
import { buildStructureNodePayloadFromContext } from "./logic/graph-navigator";
import { buildNodeExplainPayloadFromContext } from "./logic/node-explainer";
import {
  createEmptyGroupEntry,
  type StructureContext,
  type StructureGroupEntry,
} from "./logic/structure-shared";
import type { RepoNodeContextPayload } from "./logic/workspace.types";

const ANALYSIS_ID = "0195f000-0000-7000-8000-000000000001";
const PR_ANALYSIS_ID = "0195f000-0000-7000-8000-000000000002";
const COMMENT_ID = "0195f000-0000-7000-8000-000000000003";
const FIX_ID = "0195f000-0000-7000-8000-000000000004";
const DOC_ID = "0195f000-0000-7000-8000-000000000005";

const ANALYSIS_REF: AnalysisRef = {
  analysisId: ANALYSIS_ID,
  commitSha: "abc123",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

const makeGroupEntry = (
  paths: string[],
  overrides: Partial<StructureGroupEntry> = {},
): StructureGroupEntry => {
  const entry = createEmptyGroupEntry();
  entry.paths.push(...paths);
  return Object.assign(entry, overrides);
};

const makeContext = (): StructureContext =>
  ({
    aiResult: {
      executive_summary: {
        architecture_style: "modular monolith",
        purpose: "AI repository analysis platform",
        stack_details: [],
      },
      findings: [{ evidence: [{ path: "src/app.ts" }], title: "Risk A" }],
      repository_facts: [{ evidence: [{ path: "src/app.ts" }], title: "Fact A" }],
    } as unknown as AIResult,
    allInterestingPaths: ["src/app.ts", "src/routes.ts", "src/features/x.ts", "api/v1/users.ts"],
    apiPaths: new Set(["src/routes.ts"]),
    docInput: {
      api: { publicSurfacePaths: ["src/routes.ts"] },
      architecture: { dependencyCycles: [] },
      sections: {
        onboarding: { body: { firstLookPaths: ["src/app.ts"] } },
        overview: { body: { primaryModules: ["src"] } },
      },
    } as unknown as StructureContext["docInput"],
    groupMap: new Map([
      [
        "src",
        makeGroupEntry(["src/app.ts", "src/routes.ts", "src/features/x.ts"], {
          apiPaths: ["src/routes.ts"],
          semanticCounts: { ...createEmptyGroupEntry().semanticCounts, backend: 1 },
        }),
      ],
      [
        "api",
        makeGroupEntry(["api/v1/users.ts"], {
          entrypointDetails: [
            { confidence: 86, kind: "runtime", path: "api/v1/users.ts", reason: "seed" },
          ],
          semanticCounts: { ...createEmptyGroupEntry().semanticCounts, api: 1 },
        }),
      ],
    ]),
    meaningfulEntrypoints: ["src/app.ts"],
    metrics: {
      changeCoupling: [{ commits: 2, fromPath: "src/app.ts", toPath: "src/routes.ts" }],
      churnHotspots: [{ churnScore: 3, commitsInWindow: 4, path: "src/app.ts" }],
      configInventory: ["src/routes.ts"],
      dependencyHotspots: [{ exports: 1, inbound: 2, outbound: 3, path: "src/app.ts" }],
      entrypointDetails: [{ confidence: 86, kind: "runtime", path: "src/app.ts", reason: "main" }],
      frameworkFacts: [
        { category: "framework", confidence: 0.9, name: "React", sources: ["src/app.ts"] },
      ],
      graphPreviewEdges: [{ fromPath: "src/app.ts", toPath: "src/features/x.ts", weight: 2 }],
      graphReliability: {
        resolvedEdges: 4,
        unresolvedImportSpecifiers: 0,
        unresolvedSamples: [],
      },
      hotspotFiles: ["src/app.ts"],
      hotspotSignals: [
        {
          categories: ["runtime-source"],
          churnScore: 3,
          complexity: 12,
          confidence: 0.7,
          inbound: 4,
          lines: 120,
          outbound: 2,
          path: "src/app.ts",
          score: 0.8,
          source: "risk-model",
        },
      ],
      orphanModules: [],
      techStack: ["TypeScript"],
    } as unknown as RepoMetrics,
    normalizedConfigInventory: ["src/routes.ts"],
    rawTopLevelEdges: [{ id: "e1", relation: "api", source: "api", target: "src", weight: 3 }],
    signalMap: new Map(),
  }) as unknown as StructureContext;

const makeSummaryFix = (): GeneratedFixSummaryRecord => ({
  githubPrNumber: 55,
  githubPrUrl: "https://github.com/o/r/pull/55",
  id: FIX_ID,
  status: "PR_OPENED",
  title: "Fix the thing",
});

const RELATED_FINDING = {
  body: "Unbounded recursion",
  filePath: "src/app.ts",
  findingType: "PERFORMANCE",
  id: COMMENT_ID,
  line: 42,
  prAnalysisId: PR_ANALYSIS_ID,
  prNumber: 55,
  riskLevel: 8,
};

function buildNodeContextPayload(nodeId: string): RepoNodeContextPayload {
  const context = makeContext();
  const structureNode = buildStructureNodePayloadFromContext(context, ANALYSIS_REF, nodeId);

  if (structureNode == null) {
    throw new Error(`No structure node for ${nodeId}`);
  }

  const explain = buildNodeExplainPayloadFromContext(context, ANALYSIS_REF, nodeId, structureNode);

  if (explain == null) {
    throw new Error(`No explain payload for ${nodeId}`);
  }

  const relatedFiles = uniq(
    [
      structureNode.node.path,
      ...structureNode.node.previewPaths,
      ...structureNode.inspect.samplePaths,
      ...explain.sourcePaths,
    ].map((path) => normalize(path)),
  );

  return {
    ...buildInteractiveBriefNodePayload(
      analysisMapper.toInteractiveBriefNodePayloadInput({ explain, structureNode }),
    ),
    related: {
      docs: matchDocSections({
        docs: [
          {
            content: "# app\n\nsrc/app.ts is the runtime entrypoint.",
            id: DOC_ID,
            type: "README",
            version: "abc123",
          },
        ],
        graph: { nodes: [{ id: "group:src", label: "src" }] },
        nodeId,
        nodeLabel: structureNode.node.label,
        relatedFiles,
      }),
      files: relatedFiles,
      findings: [RELATED_FINDING],
      fixes: [fixesMapper.toSummary(makeSummaryFix())],
    },
  };
}

const NODE_IDS = ["group:src", "group:api", "file:src/app.ts"] as const;

describe("NodeContextOutputSchema against real builder output", () => {
  it.each(NODE_IDS)("accepts the payload the builders produce for %s", (nodeId) => {
    const payload = buildNodeContextPayload(nodeId);
    const parsed = NodeContextOutputSchema.safeParse(payload);

    if (!parsed.success) {
      throw new Error(
        `Schema rejected real node-context output for ${nodeId}: ${JSON.stringify(
          parsed.error.issues.slice(0, 8),
        )}`,
      );
    }

    expect(parsed.data?.node.id).toBe(payload.node.id);
  });

  it("accepts null for a repository with no matching node", () => {
    expect(NodeContextOutputSchema.safeParse(null).success).toBe(true);
  });

  it("still exercises a populated related block, not an empty one", () => {
    const payload = buildNodeContextPayload("group:src");

    expect(payload.related.docs.length).toBeGreaterThan(0);
    expect(payload.related.files.length).toBeGreaterThan(0);
    expect(payload.related.findings).toHaveLength(1);
    expect(payload.related.fixes).toHaveLength(1);
  });

  it("rejects a breadcrumb without nodeType, the drift the builder once shipped", () => {
    const payload = buildNodeContextPayload("file:src/app.ts");
    const broken = {
      ...payload,
      explain: {
        ...payload.explain,
        relationships: {
          ...payload.explain.relationships,
          breadcrumbs: [{ id: "group:src", label: "src", path: "src" }],
        },
      },
    };

    expect(NodeContextOutputSchema.safeParse(broken).success).toBe(false);
  });
});

describe("NodeContextOutputSchema stays structurally identical to RepoNodeContextPayload", () => {
  it("is assignable both ways, so neither side can drift alone", () => {
    type RouterNodeContext = NonNullable<NodeContextOutput>;
    type AssertIdentical<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

    const whole: AssertIdentical<RepoNodeContextPayload, RouterNodeContext> = true;
    const node: AssertIdentical<RepoNodeContextPayload["node"], RouterNodeContext["node"]> = true;
    const inspect: AssertIdentical<
      RepoNodeContextPayload["inspect"],
      RouterNodeContext["inspect"]
    > = true;
    const explain: AssertIdentical<
      RepoNodeContextPayload["explain"],
      RouterNodeContext["explain"]
    > = true;
    const explainRelationships: AssertIdentical<
      RepoNodeContextPayload["explain"]["relationships"],
      RouterNodeContext["explain"]["relationships"]
    > = true;

    expect([whole, node, inspect, explain, explainRelationships]).toStrictEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});
