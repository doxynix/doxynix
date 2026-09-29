import { beforeEach, describe, expect, it, vi } from "vitest";

const { triggerByTaskAndWait } = vi.hoisted(() => ({ triggerByTaskAndWait: vi.fn() }));

// `writer.tasks.ts` builds real `queue()`/`task()` handles at import time, which
// needs a live Trigger connection. Only the ids are read here, so stub them.
vi.mock("@trigger.dev/sdk", () => ({
  batch: { triggerByTaskAndWait },
  queue: vi.fn(() => ({})),
  task: vi.fn((config: { id: string }) => ({ ...config })),
}));

vi.mock("../logic/task-logger", () => ({
  taskLogger: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

vi.mock("../logic/context-manager", () => ({
  buildStageContextPack: vi.fn(async () => ({
    context: "",
    debug: { dropped: [], selectedEvidencePaths: [], selectedTokens: 1 },
  })),
}));

import { DocType } from "@doxynix/shared";
import type { Repo } from "@prisma/client";

import { orchestrateWriterTasks } from "./writer-orchestrator";

type BatchJob = { payload: Record<string, unknown>; task: { id: string } };

const EMPTY_DOC_INPUT = {
  api: {
    entrypoints: [],
    frameworkFacts: [],
    publicSurfacePaths: [],
    routeInventory: {
      estimatedOperations: 0,
      frameworks: [],
      httpRoutes: [],
      rpcProcedures: 0,
      source: "extracted" as const,
      sourceFiles: [],
    },
  },
  architecture: {
    dependencyCycles: [],
    dependencyHotspots: [],
    graphReliability: {
      edges: [{ fromPath: "a", kind: "internal" as const, resolved: true, specifier: "./a" }],
      resolvedEdges: 1,
      unresolvedImportSpecifiers: 0,
      unresolvedSamples: [],
    },
    modules: [],
    orphanModules: [],
  },
  codebase: {
    configFiles: [],
    fileCategoryBreakdown: [],
    frameworkFacts: [],
    languages: { distribution: [], heuristic: [], treeSitter: [], typeScriptAst: [] },
    totalFiles: 0,
  },
  report: {
    audiences: [],
    focusSections: [],
    primaryEntrypoints: [],
    secondaryEntrypoints: [],
    stackProfile: [],
  },
  risks: { changeCoupling: [], hotspots: [] },
  sections: {
    api_reference: {
      audience: "mixed" as const,
      body: { endpoints: [], publicSurfacePaths: [] },
      confidence: 0,
      evidencePaths: [],
    },
    architecture: {
      audience: "mixed" as const,
      body: { dependencyHotspots: [], modules: [], primaryEntrypoints: [] },
      confidence: 0,
      evidencePaths: [],
    },
    onboarding: {
      audience: "mixed" as const,
      body: { apiPaths: [], configPaths: [], firstLookPaths: [], newcomerSteps: [], riskPaths: [] },
      confidence: 0,
      evidencePaths: [],
    },
    overview: {
      audience: "mixed" as const,
      body: { configFiles: [], primaryModules: [], repositoryKind: "unknown", stackProfile: [] },
      confidence: 0,
      evidencePaths: [],
    },
    risks: { audience: "mixed" as const, body: { risks: [] }, confidence: 0, evidencePaths: [] },
  },
};

const EVIDENCE = {
  dependencyGraph: {
    edges: [{ fromPath: "a", kind: "internal" as const, resolved: true, specifier: "./a" }],
    resolvedEdges: 1,
    unresolvedImportSpecifiers: 0,
    unresolvedSamples: [],
  },
  languageStats: [],
  routeInventory: EMPTY_DOC_INPUT.api.routeInventory,
} as unknown as Parameters<typeof orchestrateWriterTasks>[2];

const HARD_METRICS = {
  changeCoupling: [],
  churnHotspots: [],
  dependencyCycles: [],
  dependencyHotspots: [],
  documentationInput: EMPTY_DOC_INPUT,
  graphReliability: EVIDENCE.dependencyGraph,
  mostComplexFiles: [],
  orphanModules: [],
  securityFindings: [],
  teamRoles: [],
} as unknown as Parameters<typeof orchestrateWriterTasks>[3];

const REPO = { defaultBranch: "main", id: "r1", name: "r", owner: "o" } as unknown as Repo;

const AI_RESULT = {} as unknown as Parameters<typeof orchestrateWriterTasks>[1];

async function runOrchestrator() {
  triggerByTaskAndWait.mockResolvedValue({ runs: [] });
  await orchestrateWriterTasks(
    [{ content: "export const a = 1;", path: "src/a.ts" }],
    AI_RESULT,
    EVIDENCE,
    HARD_METRICS,
    "analysis-1",
    [DocType.README],
    REPO,
    "user-1",
    "English",
  );
  return triggerByTaskAndWait.mock.calls[0]?.[0] as BatchJob[];
}

describe("orchestrateWriterTasks engineering dossier strip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Regression cover, not a red-green proof: this behaviour was already correct
   * before the typing change, so the test passes against both the old cast-based
   * strip and the new typed one. Its value is pinning the observable contract —
   * the edges must never reach the LLM prompt, and `sections` must be gone rather
   * than `null` — so a future refactor of the strip cannot silently reintroduce
   * them. The part this task actually fixed (the `as unknown as Record<string,
   * unknown>` cast and the `sections: undefined` type violation) is compile-time
   * and is not observable from a test.
   */
  it("empties the top-level and architecture graphReliability edges in the writer payload", async () => {
    const jobs = await runOrchestrator();

    expect(jobs).toHaveLength(1);
    const payload = JSON.parse(String(jobs[0]?.payload.engineeringDossierPayload)) as {
      documentationInput: { architecture: { graphReliability: { edges?: unknown[] } } };
      graphReliability: { edges?: unknown[] };
    };

    // `compactPayload` drops empty arrays entirely, so an emptied `edges` is absent
    // from the serialized payload — which is the point of the strip: the edges
    // never reach the LLM prompt.
    expect(payload.graphReliability.edges).toBeUndefined();
    expect(payload.documentationInput.architecture.graphReliability.edges).toBeUndefined();
  });

  it("drops documentationInput.sections entirely rather than nulling it", async () => {
    const jobs = await runOrchestrator();

    const payload = JSON.parse(String(jobs[0]?.payload.engineeringDossierPayload)) as {
      documentationInput: Record<string, unknown>;
    };

    expect(Object.hasOwn(payload.documentationInput, "sections")).toBe(false);
  });

  it("never emits a risks.graphReliability, which the snapshot does not define", async () => {
    const jobs = await runOrchestrator();

    const payload = JSON.parse(String(jobs[0]?.payload.engineeringDossierPayload)) as {
      documentationInput: { risks?: Record<string, unknown> };
    };

    // The removed branch wrote here. `DocumentationInputModel["risks"]` is
    // `{ changeCoupling, hotspots }`, so the write was unreachable dead code.
    // With both arrays empty `compactPayload` compacts `risks` away entirely.
    expect(payload.documentationInput.risks?.graphReliability).toBeUndefined();
  });

  it("leaves the caller's own dossier untouched", async () => {
    await runOrchestrator();

    expect(EMPTY_DOC_INPUT.architecture.graphReliability.edges).toHaveLength(1);
    expect(EVIDENCE.dependencyGraph.edges).toHaveLength(1);
  });
});
