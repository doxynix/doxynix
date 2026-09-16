import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const praFindUnique = vi.fn();
  const repoFindUnique = vi.fn();
  return {
    appError: vi.fn(),
    appInfo: vi.fn(),
    createFixFromAnalysis: vi.fn(),
    FixService: vi.fn(),
    fixesSet: vi.fn(),
    getFileContent: vi.fn(),
    praFindUnique,
    prisma: {
      pullRequestAnalysis: { findUnique: praFindUnique },
      repo: { findUnique: repoFindUnique },
    },
    redisSet: vi.fn(),
    repoFindUnique,
    task: vi.fn((def: unknown) => def),
    updateStatus: vi.fn(),
  };
});

vi.mock("@trigger.dev/sdk", () => ({
  task: mocks.task,
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    error: mocks.appError,
    info: mocks.appInfo,
  },
}));

vi.mock("@/server/core/db", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/server/core/github/github-browse.service", () => ({
  githubBrowseService: { getFileContent: mocks.getFileContent },
}));

vi.mock("@/server/core/redis", () => ({
  redisClient: { set: mocks.redisSet },
  redisService: { fixes: { set: mocks.fixesSet } },
}));

vi.mock("@/server/utils/task-config", () => ({
  TASK_CONFIGS: { generateFix: {} },
}));

vi.mock("../analysis.repository", () => ({
  analysisRepo: { updateStatus: mocks.updateStatus },
}));

vi.mock("../logic/fix-generator", () => ({
  FixService: mocks.FixService,
}));

import { generateFixTask } from "./generate-fix.task";

// The task mock returns the raw definition ({ id, ...run }). Trigger.dev's
// public Task type hides `run`, so reach the handler through `unknown`.
const runTask = (taskDef: unknown): ((...args: unknown[]) => Promise<unknown>) =>
  (taskDef as { run: (...args: unknown[]) => Promise<unknown> }).run;

// Capture task() registration at import time (beforeEach clears call history)
const registeredTaskDefs = mocks.task.mock.calls.map((call) => call[0]);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const prisma = mocks.prisma;

const repo = { defaultBranch: "main", id: 1, language: "ts", publicId: "repo-pub" };

const findings = [{ file: "a.ts", line: 1, type: "SECURITY" }];

const payload = {
  fileContents: { "a.ts": "export const x = 1;" },
  findings,
  fixId: "fix-1",
  repoId: "repo-pub",
  userId: 1,
};

const fixResult = {
  branch: "main",
  diffs: [],
  estimatedImpact: 5,
  fixedFiles: [],
  title: "Apply fix",
};

function setupFixService() {
  mocks.FixService.mockImplementation(function () {
    return { createFixFromAnalysis: mocks.createFixFromAnalysis };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("generateFixTask", () => {
  it("registers the generate-fix Trigger task", () => {
    expect(registeredTaskDefs).toContainEqual(expect.objectContaining({ id: "generate-fix" }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.repoFindUnique.mockResolvedValue(repo);
    mocks.praFindUnique.mockResolvedValue(null);
    mocks.getFileContent.mockResolvedValue({ content: "fetched code" });
    mocks.createFixFromAnalysis.mockResolvedValue(fixResult);
    mocks.fixesSet.mockResolvedValue(undefined);
    mocks.updateStatus.mockResolvedValue(undefined);
    mocks.redisSet.mockResolvedValue(undefined);
    setupFixService();
  });

  it("generates a fix from provided file contents and marks it completed", async () => {
    const result = await runTask(generateFixTask)(payload);

    expect(result).toEqual({ fixId: "fix-1", success: true });
    expect(mocks.updateStatus).toHaveBeenNthCalledWith(1, prisma, "fix-1", "GENERATING");
    expect(mocks.updateStatus).toHaveBeenLastCalledWith(prisma, "fix-1", "COMPLETED");
    expect(mocks.createFixFromAnalysis).toHaveBeenCalledWith({
      fileContents: { "a.ts": "export const x = 1;" },
      findings,
      prAnalysisId: undefined,
      repoContext: { language: "ts" },
      repoId: 1,
    });
    expect(mocks.fixesSet).toHaveBeenCalledWith("fix-1", fixResult);
    expect(mocks.getFileContent).not.toHaveBeenCalled();
  });

  it("rejects with a NOT_FOUND error and records failure when the repo is missing", async () => {
    mocks.repoFindUnique.mockResolvedValue(null);

    await expect(runTask(generateFixTask)(payload)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Repository not found",
    });

    expect(mocks.updateStatus).toHaveBeenCalledWith(prisma, "fix-1", "FAILED");
    expect(mocks.updateStatus).not.toHaveBeenCalledWith(prisma, "fix-1", "GENERATING");
    expect(mocks.redisSet).toHaveBeenCalledWith(
      "fix-result:fix-1",
      { error: "Repository not found" },
      { ex: 3600 },
    );
    expect(mocks.createFixFromAnalysis).not.toHaveBeenCalled();
  });

  it("autofetches missing file contents from the default branch", async () => {
    const result = await runTask(generateFixTask)({
      ...payload,
      fileContents: {},
    });

    expect(result).toEqual({ fixId: "fix-1", success: true });
    expect(mocks.getFileContent).toHaveBeenCalledWith(
      prisma,
      prisma,
      1,
      "repo-pub",
      "a.ts",
      "main",
    );
    expect(mocks.createFixFromAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ fileContents: { "a.ts": "fetched code" } }),
    );
  });

  it("uses the PR head sha as the target branch when prAnalysisId is provided", async () => {
    mocks.praFindUnique.mockResolvedValue({ headSha: "sha-head" });

    await runTask(generateFixTask)({
      ...payload,
      fileContents: {},
      prAnalysisId: "pra-1",
    });

    expect(mocks.getFileContent).toHaveBeenCalledWith(
      prisma,
      prisma,
      1,
      "repo-pub",
      "a.ts",
      "sha-head",
    );
  });

  it("rejects and records failure when autofetching a file fails", async () => {
    mocks.getFileContent.mockRejectedValue(new Error("network down"));

    await expect(runTask(generateFixTask)({ ...payload, fileContents: {} })).rejects.toThrow(
      "Failed to retrieve file a.ts from GitHub repository.",
    );

    expect(mocks.updateStatus).toHaveBeenCalledWith(prisma, "fix-1", "FAILED");
    expect(mocks.redisSet).toHaveBeenCalledWith(
      "fix-result:fix-1",
      { error: "Failed to retrieve file a.ts from GitHub repository." },
      { ex: 3600 },
    );
    expect(mocks.appError).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Failed to autodetect and fetch file content from GitHub" }),
    );
  });
});
