import { DocType } from "@doxynix/shared";
import type { Repo } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  apiTask: { id: "write-api" },
  architectureTask: { id: "write-architecture" },
  batch: {
    triggerByTaskAndWait: vi.fn(),
  },
  buildDocumentationInputModel: vi.fn(),
  buildStageContextPack: vi.fn(),
  buildWriterSectionPayloads: vi.fn(),
  changelogTask: { id: "write-changelog" },
  contributingTask: { id: "write-contributing" },
  readmeTask: { id: "write-readme" },
  serializeAllowedPaths: vi.fn((paths: string[]) => paths.join(",")),
  taskLogger: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  toPromptJson: vi.fn((v: unknown) => JSON.stringify(v)),
}));

vi.mock("@trigger.dev/sdk", () => ({ batch: mocks.batch }));

vi.mock("@/server/modules/analysis/engine/pipeline/documentation-input", () => ({
  buildDocumentationInputModel: mocks.buildDocumentationInputModel,
}));

vi.mock("@/server/modules/analysis/logic/task-logger", () => ({
  taskLogger: mocks.taskLogger,
}));

vi.mock("@/server/modules/analysis/logic/context-manager", () => ({
  buildStageContextPack: mocks.buildStageContextPack,
}));

vi.mock("@/server/modules/analysis/logic/payload-serialization", () => ({
  buildWriterSectionPayloads: mocks.buildWriterSectionPayloads,
  serializeAllowedPaths: mocks.serializeAllowedPaths,
  toPromptJson: mocks.toPromptJson,
}));

vi.mock("@/server/modules/analysis/tasks/writer.tasks", () => ({
  apiTask: mocks.apiTask,
  architectureTask: mocks.architectureTask,
  changelogTask: mocks.changelogTask,
  contributingTask: mocks.contributingTask,
  readmeTask: mocks.readmeTask,
}));

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepositoryEvidence } from "../engine/core/discovery.types";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { orchestrateWriterTasks } from "./writer-orchestrator";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeRepo(): Repo {
  return {
    defaultBranch: "main",
    id: 1,
    name: "repo",
    owner: "acme",
    publicId: "repo-pub",
  } as unknown as Repo;
}

function makeAnalysisResult() {
  return { analysisRuntime: undefined, complexityScore: 5 } as unknown as AIResult;
}

function makeDocInput() {
  return {
    api: { publicSurfacePaths: [], routeInventory: { sourceFiles: [] } },
    architecture: {
      body: {
        dependencyHotspots: [],
        modules: [{ path: "src/mod.ts" }],
        primaryEntrypoints: ["src/index.ts"],
      },
      evidencePaths: ["arch-evidence.ts"],
    },
    codebase: { configFiles: ["tsconfig.json"] },
    onboarding: {
      body: { configPaths: ["pkg.json"], riskPaths: ["risk.ts"] },
      evidencePaths: ["onboard.ts"],
    },
    overview: {
      body: { configFiles: ["lint.json"] },
      evidencePaths: ["overview.ts"],
    },
    report: { primaryEntrypoints: ["src/main.ts"], secondaryEntrypoints: [] },
    risks: { evidencePaths: ["risk-evidence.ts"] },
    sections: {
      api_reference: { evidencePaths: ["api-ref.ts"] },
      architecture: {
        body: {
          dependencyHotspots: [],
          modules: [{ path: "src/mod.ts" }],
          primaryEntrypoints: ["src/index.ts"],
        },
        evidencePaths: ["arch-sect.ts"],
      },
      onboarding: {
        body: { configPaths: ["pkg.json"], riskPaths: ["risk.ts"] },
        evidencePaths: ["onboard-sect.ts"],
      },
      overview: {
        body: { configFiles: ["lint.json"] },
        evidencePaths: ["overview-sect.ts"],
      },
      risks: { evidencePaths: ["risk-sect.ts"] },
    },
  };
}

function makeEvidence(): RepositoryEvidence {
  return {
    dependencyGraph: {
      edges: [],
      resolvedEdges: 0,
      unresolvedImportSpecifiers: 0,
      unresolvedSamples: [],
    },
  } as unknown as RepositoryEvidence;
}

function makeMetrics(): RepoMetrics {
  return {
    changeCoupling: [],
    churnHotspots: [],
    dependencyCycles: [],
    dependencyHotspots: [],
    documentationInput: null,
    graphReliability: undefined,
    mostComplexFiles: [],
    orphanModules: [],
    securityFindings: [],
    teamRoles: [],
  } as unknown as RepoMetrics;
}

function setupMocks() {
  const docInput = makeDocInput();
  mocks.buildDocumentationInputModel.mockReturnValue(docInput);
  mocks.buildWriterSectionPayloads.mockReturnValue({
    api: { payload: "api-payload" },
    architecture: { payload: "arch-payload" },
    contributing: { payload: "contr-payload" },
    readme: { payload: "readme-payload" },
  });

  const ctxPack = {
    context: "ctx",
    debug: { selectedEvidencePaths: ["p1.ts"], selectedTokens: 100 },
  };
  mocks.buildStageContextPack.mockResolvedValue(ctxPack);

  return docInput;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.batch.triggerByTaskAndWait.mockResolvedValue({
    runs: [
      {
        ok: true,
        output: { content: "", name: "readme", status: "missing" },
        taskIdentifier: "write-readme",
      },
      {
        ok: true,
        output: { content: "", name: "api", status: "missing" },
        taskIdentifier: "write-api",
      },
      {
        ok: true,
        output: { content: "", name: "architecture", status: "missing" },
        taskIdentifier: "write-architecture",
      },
      {
        ok: true,
        output: { content: "", name: "contributing", status: "missing" },
        taskIdentifier: "write-contributing",
      },
      {
        ok: true,
        output: { content: "", name: "changelog", status: "missing" },
        taskIdentifier: "write-changelog",
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// Empty requestedDocs
// ---------------------------------------------------------------------------
describe("orchestrateWriterTasks with empty requestedDocs", () => {
  it("returns all undefined and does not call triggerByTaskAndWait", async () => {
    setupMocks();

    const result = await orchestrateWriterTasks(
      [],
      makeAnalysisResult(),
      makeEvidence(),
      makeMetrics(),
      "analysis-1",
      [],
      makeRepo(),
      1,
      "English",
    );

    expect(result.generatedReadme).toBeUndefined();
    expect(result.generatedApiMarkdown).toBeUndefined();
    expect(result.generatedArchitecture).toBeUndefined();
    expect(result.generatedContributing).toBeUndefined();
    expect(result.generatedChangelog).toBeUndefined();
    expect(result.swaggerYaml).toBeUndefined();
    expect(mocks.batch.triggerByTaskAndWait).not.toHaveBeenCalled();
    expect(mocks.taskLogger.warn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// README + API only
// ---------------------------------------------------------------------------
describe("orchestrateWriterTasks with README + API", () => {
  it("triggers 2 writer jobs and maps outputs", async () => {
    setupMocks();
    mocks.batch.triggerByTaskAndWait.mockResolvedValue({
      runs: [
        {
          ok: true,
          output: { content: "# Readme", name: "readme", status: "llm" },
          taskIdentifier: "write-readme",
        },
        {
          ok: true,
          output: { content: "API doc", name: "api", status: "llm" },
          taskIdentifier: "write-api",
        },
      ],
    });

    const result = await orchestrateWriterTasks(
      [],
      makeAnalysisResult(),
      makeEvidence(),
      makeMetrics(),
      "analysis-1",
      [DocType.README, DocType.API],
      makeRepo(),
      1,
      "English",
    );

    expect(result.generatedReadme).toBe("# Readme");
    expect(result.generatedApiMarkdown).toBe("API doc");
    expect(mocks.batch.triggerByTaskAndWait).toHaveBeenCalledTimes(1);

    const jobs = mocks.batch.triggerByTaskAndWait.mock.calls[0]![0] as Array<{
      options: { concurrencyKey: string };
      payload: Record<string, unknown>;
      task: { id: string };
    }>;
    expect(jobs).toHaveLength(2);
    expect(jobs[0]!.task.id).toBe("write-readme");
    expect(jobs[1]!.task.id).toBe("write-api");

    // Verify README payload structure
    const readmePayload = jobs[0]!.payload;
    expect(readmePayload.branch).toBe("main");
    expect(readmePayload.repoId).toBe("repo-pub");
    expect(readmePayload.userId).toBe(1);
    expect(readmePayload.selectedTokens).toBe(100);
    expect(readmePayload.language).toBe("English");
    expect(typeof readmePayload.engineeringDossierPayload).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Failed run
// ---------------------------------------------------------------------------
describe("orchestrateWriterTasks with failed run", () => {
  it("collects error and marks status as failed", async () => {
    setupMocks();
    mocks.batch.triggerByTaskAndWait.mockResolvedValue({
      runs: [
        {
          error: new Error("timeout"),
          ok: false,
          taskIdentifier: "write-readme",
        },
        {
          ok: true,
          output: { content: "API doc", name: "api", status: "llm" },
          taskIdentifier: "write-api",
        },
      ],
    });

    const analysisResult = makeAnalysisResult();
    const result = await orchestrateWriterTasks(
      [],
      analysisResult,
      makeEvidence(),
      makeMetrics(),
      "analysis-1",
      [DocType.README, DocType.API],
      makeRepo(),
      1,
      "English",
    );

    expect(result.generatedReadme).toBeUndefined();
    expect(result.generatedApiMarkdown).toBe("API doc");
    expect(analysisResult.analysisRuntime).toBeDefined();
  });
});
