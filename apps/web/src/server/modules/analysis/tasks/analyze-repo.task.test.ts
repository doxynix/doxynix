import os from "node:os";

import { Status } from "@doxynix/shared";
import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  analyzeRepository: vi.fn(),
  appError: vi.fn(),
  appInfo: vi.fn(),
  buildRepositoryArtifacts: vi.fn(),
  calculateBusFactor: vi.fn(),
  calculateTeamRoles: vi.fn(),
  cleanup: vi.fn(),
  cloneRepository: vi.fn(),
  computeChangeCoupling: vi.fn(),
  computeGitChurnHotspots: vi.fn(),
  finalize: vi.fn(),
  generateDeepDocs: vi.fn(),
  getAnalysisContext: vi.fn(),
  handleError: vi.fn(),
  milestone: vi.fn(),
  prisma: {},
  readAndFilterFiles: vi.fn(),
  runAiPipeline: vi.fn(),
  saveResults: vi.fn(),
  task: vi.fn((def: unknown) => def),
  taskError: vi.fn(),
  taskInfo: vi.fn(),
  taskLog: vi.fn(),
  taskSuccess: vi.fn(),
  taskWarn: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  task: mocks.task,
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    debug: vi.fn(),
    error: mocks.appError,
    info: mocks.appInfo,
    warn: vi.fn(),
  },
}));

vi.mock("@/server/core/db", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/server/core/github/git", () => ({
  cloneRepository: mocks.cloneRepository,
  getAnalysisContext: mocks.getAnalysisContext,
}));

vi.mock("@/server/core/github/github-api", () => ({
  calculateBusFactor: mocks.calculateBusFactor,
}));

vi.mock("@/server/modules/analysis/logic/task-logger", () => ({
  taskLogger: {
    error: mocks.taskError,
    finalize: mocks.finalize,
    info: mocks.taskInfo,
    log: mocks.taskLog,
    milestone: mocks.milestone,
    success: mocks.taskSuccess,
    warn: mocks.taskWarn,
  },
}));

vi.mock("@/server/utils/task-config", () => ({
  TASK_CONFIGS: { analyzeRepo: {} },
}));

vi.mock("@/server/utils/utils", () => ({
  cleanup: mocks.cleanup,
  handleError: mocks.handleError,
  readAndFilterFiles: mocks.readAndFilterFiles,
}));

vi.mock("../ai/ai-pipeline", () => ({
  generateDeepDocs: mocks.generateDeepDocs,
  runAiPipeline: mocks.runAiPipeline,
}));

vi.mock("../analysis.service", () => ({
  repoAnalysisService: { saveResults: mocks.saveResults },
}));

vi.mock("../engine/metrics/code-metrics", () => ({
  analyzeRepository: mocks.analyzeRepository,
}));

vi.mock("../engine/metrics/common-metrics", () => ({
  calculateTeamRoles: mocks.calculateTeamRoles,
  computeChangeCoupling: mocks.computeChangeCoupling,
  computeGitChurnHotspots: mocks.computeGitChurnHotspots,
}));

vi.mock("../engine/pipeline/artifacts", () => ({
  buildRepositoryArtifacts: mocks.buildRepositoryArtifacts,
}));

import { analyzeRepoTask } from "./analyze-repo.task";

// The task mock returns the raw definition ({ id, ...run }). Trigger.dev's
// public Task type hides `run`, so reach the handler through `unknown`.
const runTask = (taskDef: unknown): ((...args: unknown[]) => Promise<unknown>) =>
  (taskDef as { run: (...args: unknown[]) => Promise<unknown> }).run;

// Capture task() registration at import time (beforeEach clears call history)
const registeredTaskDefs = mocks.task.mock.calls.map((call: unknown[]) => call[0]);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const tempClonePath = join(os.tmpdir(), "doxynix-clone-an-1");

const payload = {
  analysisId: "an-1",
  docTypes: [],
  forceRefresh: false,
  instructions: undefined,
  language: "English",
  selectedBranch: undefined,
  selectedFiles: ["**/*"],
  userId: 1,
};

const repo = { defaultBranch: "main", id: 1, publicId: "p1" };
const validFiles = [{ content: "c", path: "a.ts" }];
const evidence = { languages: [] };
const hardMetrics = { changeCoupling: [], churnHotspots: [] };
const aiResult = { analysisRuntime: {}, swaggerYaml: undefined };
const deepDocsResult = {
  generatedApiMarkdown: "m",
  generatedArchitecture: "a",
  generatedChangelog: "c",
  generatedContributing: "co",
  generatedReadme: "r",
  swaggerYaml: "yaml",
};

function setupHappyPath() {
  mocks.getAnalysisContext.mockResolvedValue({
    currentSha: "sha-1",
    repo,
    token: "tok",
  });
  mocks.calculateBusFactor.mockResolvedValue({ busFactor: 3, rawContributors: [{ login: "a" }] });
  mocks.cloneRepository.mockResolvedValue(undefined);
  mocks.readAndFilterFiles.mockResolvedValue(validFiles);
  mocks.analyzeRepository.mockResolvedValue({ evidence, metrics: {} });
  mocks.computeGitChurnHotspots.mockResolvedValue([]);
  mocks.computeChangeCoupling.mockResolvedValue([]);
  mocks.calculateTeamRoles.mockReturnValue({ frontend: 1 });
  mocks.buildRepositoryArtifacts.mockReturnValue({ facts: [], findings: [] });
  mocks.runAiPipeline.mockResolvedValue(aiResult);
  mocks.generateDeepDocs.mockResolvedValue(deepDocsResult);
  mocks.saveResults.mockResolvedValue(1);
  mocks.finalize.mockResolvedValue(undefined);
  mocks.cleanup.mockResolvedValue(undefined);
  mocks.handleError.mockResolvedValue(undefined);
}

describe("analyzeRepoTask", () => {
  it("registers the analyze-repo Trigger task", () => {
    expect(registeredTaskDefs).toContainEqual(expect.objectContaining({ id: "analyze-repo" }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("runs the full analysis pipeline and saves results", async () => {
    const result = await runTask(analyzeRepoTask)(payload);

    expect(result).toEqual({ success: true });
    expect(mocks.getAnalysisContext).toHaveBeenCalledWith("an-1", 1, false);
    expect(mocks.runAiPipeline).toHaveBeenCalledWith(
      validFiles,
      [],
      [],
      evidence,
      hardMetrics,
      undefined,
      "an-1",
      "English",
      1,
      "p1",
      "main",
    );
    expect(mocks.saveResults).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisId: "an-1",
        busFactor: 3,
        repo: expect.objectContaining({ publicId: "p1" }),
        userId: 1,
      }),
    );
    expect(mocks.finalize).toHaveBeenCalledWith(
      "an-1",
      Status.DONE,
      "Analysis completed successfully",
    );
    expect(mocks.generateDeepDocs).toHaveBeenCalledWith(
      validFiles,
      aiResult,
      evidence,
      hardMetrics,
      "an-1",
      [],
      repo,
      1,
      "English",
    );
    expect(mocks.cleanup).toHaveBeenCalledWith(tempClonePath);
    expect(mocks.milestone).toHaveBeenCalledWith({
      analysisId: "an-1",
      msg: "Initializing analysis engine",
      percent: 5,
      userId: 1,
    });
  });

  it("skips the run when the repository snapshot is unchanged", async () => {
    mocks.getAnalysisContext.mockResolvedValue({
      currentSha: "sha-1",
      repo: null,
      token: "tok",
    });

    const result = await runTask(analyzeRepoTask)(payload);

    expect(result).toEqual({ reason: "SHA_MATCH", skipped: true });
    expect(mocks.finalize).toHaveBeenCalledWith(
      "an-1",
      Status.DONE,
      "Current commit SHA matches last analysis. Skipping re-run.",
    );
    expect(mocks.runAiPipeline).not.toHaveBeenCalled();
    expect(mocks.saveResults).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledWith(tempClonePath);
  });

  it("marks the analysis failed and rethrows when a stage errors", async () => {
    const boom = new Error("boom");
    mocks.analyzeRepository.mockRejectedValue(boom);

    await expect(runTask(analyzeRepoTask)(payload)).rejects.toThrow("boom");

    expect(mocks.taskError).toHaveBeenCalledWith("Analysis failed: boom");
    expect(mocks.finalize).toHaveBeenCalledWith("an-1", Status.FAILED, "boom");
    expect(mocks.appError).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Repo analyze failed: boom" }),
    );
    expect(mocks.handleError).toHaveBeenCalledWith(boom, "an-1", "user:1", tempClonePath);
    expect(mocks.cleanup).toHaveBeenCalledWith(tempClonePath);
  });

  it("uses the selected branch instead of the default branch", async () => {
    await runTask(analyzeRepoTask)({ ...payload, selectedBranch: "dev" });

    expect(mocks.runAiPipeline).toHaveBeenCalledWith(
      validFiles,
      [],
      [],
      evidence,
      hardMetrics,
      undefined,
      "an-1",
      "English",
      1,
      "p1",
      "dev",
    );
  });

  it("logs cleanup failures without affecting the run result", async () => {
    mocks.cleanup.mockRejectedValue(new Error("rm failed"));

    const result = await runTask(analyzeRepoTask)(payload);

    expect(result).toEqual({ success: true });
    expect(mocks.appError).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Failed to clean up clone path",
        tempClonePath,
      }),
    );
  });
});
