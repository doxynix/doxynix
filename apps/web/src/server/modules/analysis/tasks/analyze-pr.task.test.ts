import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const addComments = vi.fn().mockResolvedValue(undefined);
  const analysisFindFirst = vi.fn();
  const createCommitStatus = vi.fn().mockResolvedValue(undefined);
  const paginate = vi.fn();
  const pullsUpdate = vi.fn().mockResolvedValue(undefined);
  const repoFindUnique = vi.fn();
  const storeChangedFilesSnapshot = vi.fn().mockResolvedValue(undefined);
  const updatePRAnalysisStatus = vi.fn().mockResolvedValue(undefined);

  return {
    addComments,
    analysisFindFirst,
    analyzeCompleted: vi.fn(),
    analyzeFailed: vi.fn(),
    analyzePRDiff: vi.fn(),
    analyzeStarted: vi.fn(),
    appError: vi.fn(),
    appInfo: vi.fn(),
    appWarn: vi.fn(),
    commentsPosted: vi.fn(),
    createCommitStatus,
    DifferentialAnalyzer: vi.fn(),
    formatFinding: vi.fn(),
    getClientContext: vi.fn(),
    getConfig: vi.fn(),
    octokit: {
      paginate,
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({ data: { body: "old" } }),
          listFiles: {},
          update: pullsUpdate,
        },
        repos: {
          createCommitStatus,
          listCommits: vi.fn().mockResolvedValue({ data: [] }),
        },
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({ data: [] }),
        },
      },
    },
    paginate,
    postComments: vi.fn(),
    postMainDashboardComment: vi.fn(),
    prisma: {
      analysis: { findFirst: analysisFindFirst },
      pullRequestAnalysis: {},
      repo: { findUnique: repoFindUnique },
    },
    pullsUpdate,
    repoFindUnique,
    storeChangedFilesSnapshot,
    task: vi.fn((def: unknown) => def),
    taskError: vi.fn(),
    updatePRAnalysisStatus,
  };
});

vi.mock("@trigger.dev/sdk", () => ({
  task: mocks.task,
}));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: {
    debug: vi.fn(),
    error: mocks.appError,
    info: mocks.appInfo,
    warn: mocks.appWarn,
  },
}));

vi.mock("@/server/core/db", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/server/core/github/github-provider", () => ({
  getClientContext: mocks.getClientContext,
}));

vi.mock("@/server/utils/pr-analysis-logger", () => ({
  prAnalysisLogger: {
    analyzeCompleted: mocks.analyzeCompleted,
    analyzeFailed: mocks.analyzeFailed,
    analyzeStarted: mocks.analyzeStarted,
    commentsPosted: mocks.commentsPosted,
  },
}));

vi.mock("@/server/utils/task-config", () => ({
  TASK_CONFIGS: { analyzePr: {} },
}));

vi.mock("../analysis.repository", () => ({
  analysisRepo: {
    addComments: mocks.addComments,
    storeChangedFilesSnapshot: mocks.storeChangedFilesSnapshot,
    updatePRAnalysisStatus: mocks.updatePRAnalysisStatus,
  },
}));

vi.mock("../logic/comment-poster", () => ({
  CommentFormatter: {
    formatFinding: mocks.formatFinding,
    formatForComment: vi.fn(),
  },
  gitHubCommentPoster: {
    postComments: mocks.postComments,
    postMainDashboardComment: mocks.postMainDashboardComment,
  },
}));

vi.mock("../logic/differential-analyzer", () => ({
  DifferentialAnalyzer: mocks.DifferentialAnalyzer,
}));

vi.mock("../logic/pr-config", () => ({
  PRConfigService: { getConfig: mocks.getConfig },
}));

vi.mock("../logic/task-logger", () => ({
  taskLogger: { error: mocks.taskError },
}));

import { analyzePrTask } from "./analyze-pr.task";

// The task mock returns the raw definition ({ id, ...run }). Trigger.dev's
// public Task type hides `run`, so reach the handler through `unknown`.
type PrRunResult = {
  analysisId: number;
  duration: number;
  findings: number;
  riskScore: number;
  success: boolean;
};
const runTask = <O = unknown>(taskDef: unknown): ((...args: unknown[]) => Promise<O>) =>
  (taskDef as { run: (...args: unknown[]) => Promise<O> }).run;

// Capture task() registration at import time (beforeEach clears call history)
const registeredTaskDefs = mocks.task.mock.calls.map((call) => call[0]);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const payload = {
  analysisId: 42,
  baseSha: "b",
  headSha: "h",
  owner: "o",
  prNumber: 7,
  repoId: 9,
  repoName: "r",
};

const ghFilesFixture = [
  {
    additions: 1,
    deletions: 1,
    filename: "src/a.ts",
    patch: "@@ -1,1 +1,3 @@\n+export const x = 1;\n",
    previous_filename: null,
    status: "modified",
  },
];

const findingFixture = {
  codeSnippet: "export const x = 1;",
  file: "src/a.ts",
  line: 1,
  message: "m",
  score: 80,
  severity: "HIGH" as const,
  suggestion: "s",
  title: "t",
  type: "SECURITY",
};

const diffResultFixture = {
  findings: [findingFixture],
  riskScore: 42,
  summary: "Summary text",
};

const fullConfig = {
  ciSkip: false,
  commentStyle: "FULL" as const,
  enabled: true,
  excludePatterns: [],
  focusAreas: [],
  tokenBudget: 100,
};

function setupHappyPath() {
  mocks.getClientContext.mockResolvedValue({ octokit: mocks.octokit });
  mocks.repoFindUnique.mockResolvedValue({ publicId: "p1", userId: 1 });
  mocks.analysisFindFirst.mockResolvedValue(null);
  mocks.getConfig.mockResolvedValue(fullConfig);
  mocks.analyzePRDiff.mockResolvedValue(diffResultFixture);
  mocks.paginate.mockResolvedValue(ghFilesFixture);
  mocks.postMainDashboardComment.mockResolvedValue(undefined);
  mocks.postComments.mockResolvedValue([{ finding: findingFixture }]);
  mocks.formatFinding.mockReturnValue("formatted");
  mocks.DifferentialAnalyzer.mockImplementation(function () {
    return { analyzePRDiff: mocks.analyzePRDiff };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("analyzePrTask", () => {
  it("registers the analyze-pr Trigger task", () => {
    expect(registeredTaskDefs).toContainEqual(expect.objectContaining({ id: "analyze-pr" }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("rejects when the repo does not exist", async () => {
    mocks.repoFindUnique.mockResolvedValue(null);

    await expect(runTask(analyzePrTask)(payload)).rejects.toThrow("Repo with ID 9 not found");

    expect(mocks.getClientContext).not.toHaveBeenCalled();
    expect(mocks.createCommitStatus).not.toHaveBeenCalled();
    expect(mocks.updatePRAnalysisStatus).toHaveBeenCalledWith(mocks.prisma, 42, "FAILED", {
      error: "Repo with ID 9 not found",
    });
    expect(mocks.analyzeFailed).toHaveBeenCalledWith(9, 7, "Repo with ID 9 not found");
  });

  it("analyzes the PR diff, posts comments, and completes with success", async () => {
    const result = await runTask<PrRunResult>(analyzePrTask)(payload);

    expect(result).toMatchObject({ analysisId: 42, findings: 1, riskScore: 42, success: true });
    expect(typeof result.duration).toBe("number");
    expect(mocks.getClientContext).toHaveBeenCalledWith(mocks.prisma, 1, "o");
    expect(mocks.createCommitStatus).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sha: "h", state: "pending" }),
    );
    expect(mocks.createCommitStatus).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sha: "h", state: "success" }),
    );
    expect(mocks.updatePRAnalysisStatus).toHaveBeenCalledWith(mocks.prisma, 42, "ANALYZING");
    expect(mocks.updatePRAnalysisStatus).toHaveBeenCalledWith(
      mocks.prisma,
      42,
      "COMPLETED",
      expect.objectContaining({ findingsJson: expect.any(Array), riskScore: 42 }),
    );
    expect(mocks.analyzeStarted).toHaveBeenCalledWith(9, 7, 100);
    expect(mocks.paginate).toHaveBeenCalledWith(mocks.octokit.rest.pulls.listFiles, {
      owner: "o",
      per_page: 100,
      pull_number: 7,
      repo: "r",
    });
    expect(mocks.storeChangedFilesSnapshot).toHaveBeenCalledWith(mocks.prisma, 42, [
      {
        additions: 1,
        deletions: 1,
        filePath: "src/a.ts",
        previousFilePath: null,
        status: "modified",
      },
    ]);
    expect(mocks.DifferentialAnalyzer).toHaveBeenCalledWith(fullConfig);
    expect(mocks.analyzePRDiff).toHaveBeenCalledWith(
      expect.objectContaining({ baseSha: "b", headSha: "h", owner: "o", prNumber: 7 }),
      "{}",
      { branch: "h", repoId: "p1", userId: 1 },
    );
    expect(mocks.postMainDashboardComment).toHaveBeenCalledWith(
      mocks.octokit,
      "o",
      "r",
      7,
      expect.any(Array),
    );
    expect(mocks.octokit.rest.pulls.get).toHaveBeenCalledWith({
      owner: "o",
      pull_number: 7,
      repo: "r",
    });
    expect(mocks.pullsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("<!-- DOXYNIX_START -->") }),
    );
    expect(mocks.postComments).toHaveBeenCalledWith(
      mocks.octokit,
      "o",
      "r",
      7,
      "h",
      expect.any(Array),
      "FULL",
    );
    expect(mocks.commentsPosted).toHaveBeenCalledWith(9, 7, 1);
    expect(mocks.formatFinding).toHaveBeenCalledWith(findingFixture, "FULL");
    expect(mocks.addComments).toHaveBeenCalledWith(mocks.prisma, 42, [
      {
        body: "formatted",
        filePath: "src/a.ts",
        findingType: "SECURITY",
        line: 1,
        riskLevel: 80,
      },
    ]);
    expect(mocks.analyzeCompleted).toHaveBeenCalledWith(9, 7, expect.any(Number), 1);
  });

  it("skips posting comments when commentStyle is OFF", async () => {
    mocks.getConfig.mockResolvedValue({ ...fullConfig, commentStyle: "OFF" });

    const result = await runTask<PrRunResult>(analyzePrTask)(payload);

    expect(result.success).toBe(true);
    expect(mocks.postComments).not.toHaveBeenCalled();
    expect(mocks.addComments).not.toHaveBeenCalled();
    expect(mocks.updatePRAnalysisStatus).toHaveBeenCalledWith(
      mocks.prisma,
      42,
      "COMPLETED",
      expect.objectContaining({ riskScore: 42 }),
    );
  });

  it("adds an Analysis Completed singleton when no findings are reported", async () => {
    mocks.analyzePRDiff.mockResolvedValue({ findings: [], riskScore: 0, summary: "" });
    mocks.postComments.mockResolvedValue([]);

    const result = await runTask<PrRunResult>(analyzePrTask)(payload);

    expect(result.findings).toBe(0);
    expect(mocks.postMainDashboardComment).not.toHaveBeenCalled();
    expect(mocks.postComments).toHaveBeenCalledWith(mocks.octokit, "o", "r", 7, "h", [], "FULL");
    expect(mocks.commentsPosted).toHaveBeenCalledWith(9, 7, 0);
    expect(mocks.addComments).not.toHaveBeenCalled();
    expect(mocks.updatePRAnalysisStatus).toHaveBeenCalledWith(
      mocks.prisma,
      42,
      "COMPLETED",
      expect.objectContaining({
        findingsJson: [expect.objectContaining({ title: "Analysis Completed" })],
      }),
    );
  });

  it("records a failure and rethrows when the diff fetch fails", async () => {
    mocks.paginate.mockRejectedValue(new Error("pagination boom"));

    await expect(runTask(analyzePrTask)(payload)).rejects.toThrow("pagination boom");

    expect(mocks.taskError).toHaveBeenCalledWith("CRITICAL Task Execution Failed: pagination boom");
    expect(mocks.createCommitStatus).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ state: "failure" }),
    );
    expect(mocks.updatePRAnalysisStatus).toHaveBeenCalledWith(mocks.prisma, 42, "FAILED", {
      error: "pagination boom",
    });
    expect(mocks.analyzeFailed).toHaveBeenCalledWith(9, 7, "pagination boom");
  });

  it("logs a validation warning and stores raw findings when persistence validation fails", async () => {
    mocks.analyzePRDiff.mockResolvedValue({
      findings: [
        {
          ...findingFixture,
          line: 0,
        },
      ],
      riskScore: 42,
      summary: "Summary text",
    });

    const result = await runTask<PrRunResult>(analyzePrTask)(payload);

    expect(result.success).toBe(true);
    expect(mocks.appWarn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_findings_validation_failed" }),
    );
    expect(mocks.updatePRAnalysisStatus).toHaveBeenCalledWith(
      mocks.prisma,
      42,
      "COMPLETED",
      expect.objectContaining({
        findingsJson: [expect.objectContaining({ line: 0, title: "t", type: "SECURITY" })],
      }),
    );
  });
});
