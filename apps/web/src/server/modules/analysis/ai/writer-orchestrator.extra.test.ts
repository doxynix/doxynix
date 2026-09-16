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
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.batch.triggerByTaskAndWait.mockResolvedValue({ runs: [] });
});

// ---------------------------------------------------------------------------
// Swagger extraction
// ---------------------------------------------------------------------------
describe("orchestrateWriterTasks swagger extraction", () => {
  it("extracts YAML block and strips from markdown", async () => {
    setupMocks();
    const apiContent =
      "intro text\n# OpenAPI Specification\n```yaml\nopenapi: '3.0.0'\ninfo: x\n```\noutro";
    mocks.batch.triggerByTaskAndWait.mockResolvedValue({
      runs: [
        {
          ok: true,
          output: { content: apiContent, name: "api", status: "llm" },
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
      [DocType.API],
      makeRepo(),
      1,
      "English",
    );

    expect(result.swaggerYaml).toBeDefined();
    expect(result.swaggerYaml).toContain("openapi: '3.0.0'");
    expect(result.generatedApiMarkdown).toBeDefined();
    // The yaml block is extracted out of the markdown
    expect(result.generatedApiMarkdown).not.toContain("```yaml");
    expect(result.generatedApiMarkdown).not.toContain("openapi: '3.0.0'");
    // Intro/outro text survives
    expect(result.generatedApiMarkdown).toContain("intro text");
    expect(result.generatedApiMarkdown).toContain("outro");
  });
});

// ---------------------------------------------------------------------------
// CHANGELOG doc type
// ---------------------------------------------------------------------------
describe("orchestrateWriterTasks CHANGELOG", () => {
  it("sends correct payload for CHANGELOG job", async () => {
    setupMocks();
    mocks.batch.triggerByTaskAndWait.mockResolvedValue({
      runs: [
        {
          ok: true,
          output: { content: "# Changelog", name: "changelog", status: "llm" },
          taskIdentifier: "write-changelog",
        },
      ],
    });

    const analysisResult = makeAnalysisResult();
    const repo = makeRepo();
    await orchestrateWriterTasks(
      [],
      analysisResult,
      makeEvidence(),
      makeMetrics(),
      "analysis-1",
      [DocType.CHANGELOG],
      repo,
      1,
      "English",
    );

    const jobs = mocks.batch.triggerByTaskAndWait.mock.calls[0]![0] as Array<{
      payload: Record<string, unknown>;
      task: { id: string };
    }>;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.task.id).toBe("write-changelog");
    expect(jobs[0]!.payload.analysisId).toBe("analysis-1");
    expect(jobs[0]!.payload.language).toBe("English");
    expect(jobs[0]!.payload.userId).toBe(1);
    expect(jobs[0]!.payload.repo).toBe(repo);
    expect(analysisResult.analysisRuntime).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ARCHITECTURE payload has extra fields
// ---------------------------------------------------------------------------
describe("orchestrateWriterTasks ARCHITECTURE payload", () => {
  it("includes moduleContext, onboardingPayload, risksPayload", async () => {
    setupMocks();
    mocks.batch.triggerByTaskAndWait.mockResolvedValue({
      runs: [
        {
          ok: true,
          output: { content: "", name: "architecture", status: "missing" },
          taskIdentifier: "write-architecture",
        },
      ],
    });

    await orchestrateWriterTasks(
      [],
      makeAnalysisResult(),
      makeEvidence(),
      makeMetrics(),
      "analysis-1",
      [DocType.ARCHITECTURE],
      makeRepo(),
      1,
      "English",
    );

    const jobs = mocks.batch.triggerByTaskAndWait.mock.calls[0]![0] as Array<{
      payload: Record<string, unknown>;
      task: { id: string };
    }>;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.task.id).toBe("write-architecture");
    expect(jobs[0]!.payload).toHaveProperty("moduleContext");
    expect(jobs[0]!.payload).toHaveProperty("onboardingPayload");
    expect(jobs[0]!.payload).toHaveProperty("risksPayload");
  });
});

// ---------------------------------------------------------------------------
// engineeringDossierPayload is JSON string
// ---------------------------------------------------------------------------
describe("engineeringDossierPayload serialization", () => {
  it("is a JSON string for README payload", async () => {
    setupMocks();
    mocks.batch.triggerByTaskAndWait.mockResolvedValue({
      runs: [
        {
          ok: true,
          output: { content: "", name: "readme", status: "missing" },
          taskIdentifier: "write-readme",
        },
      ],
    });

    await orchestrateWriterTasks(
      [],
      makeAnalysisResult(),
      makeEvidence(),
      makeMetrics(),
      "analysis-1",
      [DocType.README],
      makeRepo(),
      1,
      "English",
    );

    const jobs = mocks.batch.triggerByTaskAndWait.mock.calls[0]![0] as Array<{
      payload: Record<string, unknown>;
    }>;
    const edp = jobs[0]!.payload.engineeringDossierPayload as string;
    expect(typeof edp).toBe("string");
    expect(edp.startsWith("{")).toBe(true);
    expect(edp.endsWith("}")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// serializeAllowedPaths received paths and limit
// ---------------------------------------------------------------------------
describe("serializeAllowedPaths called correctly", () => {
  it("is called for each writer's allowed paths", async () => {
    setupMocks();
    mocks.batch.triggerByTaskAndWait.mockResolvedValue({
      runs: [
        {
          ok: true,
          output: { content: "", name: "readme", status: "missing" },
          taskIdentifier: "write-readme",
        },
      ],
    });

    await orchestrateWriterTasks(
      [],
      makeAnalysisResult(),
      makeEvidence(),
      makeMetrics(),
      "analysis-1",
      [DocType.README],
      makeRepo(),
      1,
      "English",
    );

    expect(mocks.serializeAllowedPaths).toHaveBeenCalled();
    // First call receives an array of paths
    const firstCallArgs = mocks.serializeAllowedPaths.mock.calls[0]! as unknown as [
      string[],
      number,
    ];
    expect(Array.isArray(firstCallArgs[0])).toBe(true);
  });
});
