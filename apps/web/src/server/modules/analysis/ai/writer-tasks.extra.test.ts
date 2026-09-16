import type { Repo } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  buildApiWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildApiWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildArchitectureWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildArchitectureWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildChangelogWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildChangelogWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildContributingWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildContributingWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildReadmeWriterSystemPrompt: vi.fn((...a: unknown[]) => "sys:" + a[0]),
  buildReadmeWriterUserPrompt: vi.fn((...a: unknown[]) => "prompt:" + a[0]),
  buildRepositoryToolProfile: vi.fn(() => ({})),
  callWithFallback: vi.fn(async () => "llm-output"),
  getActiveModels: vi.fn(async () => ({
    AGENT: ["a1"],
    ARCHITECT: ["a1"],
    CARTOGRAPHER: ["a1"],
    FALLBACK: ["a1"],
    POWERFUL: ["a1"],
    SENTINEL: ["a1"],
    WRITER: ["w1", "w2"],
  })),
  getClientContext: vi.fn(),
  prisma: {
    analysis: { findFirst: vi.fn() },
    document: { findFirst: vi.fn() },
    repo: { findUnique: vi.fn() },
  },
  SAFETY_SETTINGS: [],
  unwrapAiText: vi.fn((x: unknown) => (typeof x === "string" ? x : JSON.stringify(x))),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/core/github/github-provider", () => ({
  getClientContext: mocks.getClientContext,
}));
vi.mock("@/server/utils/call", () => ({ callWithFallback: mocks.callWithFallback }));
vi.mock("@/server/utils/optimizers", () => ({ unwrapAiText: mocks.unwrapAiText }));
vi.mock("./ai-constants", () => ({
  getActiveModels: mocks.getActiveModels,
  SAFETY_SETTINGS: mocks.SAFETY_SETTINGS,
}));
vi.mock("./ai-tools", () => ({ buildRepositoryToolProfile: mocks.buildRepositoryToolProfile }));
vi.mock("./prompts-refactored", () => ({
  buildApiWriterSystemPrompt: mocks.buildApiWriterSystemPrompt,
  buildApiWriterUserPrompt: mocks.buildApiWriterUserPrompt,
  buildArchitectureWriterSystemPrompt: mocks.buildArchitectureWriterSystemPrompt,
  buildArchitectureWriterUserPrompt: mocks.buildArchitectureWriterUserPrompt,
  buildChangelogWriterSystemPrompt: mocks.buildChangelogWriterSystemPrompt,
  buildChangelogWriterUserPrompt: mocks.buildChangelogWriterUserPrompt,
  buildContributingWriterSystemPrompt: mocks.buildContributingWriterSystemPrompt,
  buildContributingWriterUserPrompt: mocks.buildContributingWriterUserPrompt,
  buildReadmeWriterSystemPrompt: mocks.buildReadmeWriterSystemPrompt,
  buildReadmeWriterUserPrompt: mocks.buildReadmeWriterUserPrompt,
}));

import type { AIResult } from "../engine/core/analysis-result.schemas";
import { executeChangelogWriter, executeReadmeWriter } from "./writer-tasks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAnalysisResult(): AIResult {
  return {
    executive_summary: {
      architecture_style: "Layered",
      purpose: "App",
      stack_details: ["TS"],
    },
    findings: [],
    onboarding_guide: { prerequisites: [], setup_steps: [] },
    refactoring_targets: [],
    sections: {
      api_structure: "",
      data_flow: "",
      security_audit: { risks: [], score: 5 },
    },
  };
}

function makeRepo(): Repo {
  return {
    defaultBranch: "main",
    id: 1,
    name: "repo",
    owner: "acme",
    publicId: "repo-pub",
  } as unknown as Repo;
}

const baseArgs = {
  analysisId: "analysis-1",
  branch: "main",
  context: "context-str",
  engineeringDossierPayload: "dossier",
  language: "English",
  payload: "payload-str",
  repoId: "repo-pub",
  userId: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callWithFallback.mockResolvedValue("llm-output");
  mocks.unwrapAiText.mockImplementation((x: unknown) =>
    typeof x === "string" ? x : JSON.stringify(x),
  );
});

// ---------------------------------------------------------------------------
// executeChangelogWriter — no previous analysis (else branch)
// ---------------------------------------------------------------------------
describe("executeChangelogWriter", () => {
  it("formats commits and PRs from pull list when no previous analysis", async () => {
    const octokit = {
      rest: {
        pulls: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                labels: [{ name: "bug" }],
                merged_at: "2024-01-01",
                number: 5,
                title: "Fix",
                user: { login: "alice" },
              },
              {
                labels: [],
                merged_at: null,
                number: 6,
                title: "Unmerged",
                user: { login: "bob" },
              },
            ],
          }),
        },
        repos: {
          compareCommits: vi.fn(),
          listCommits: vi.fn().mockResolvedValue({
            data: [{ commit: { author: { name: "alice" }, message: "fix typo" } }],
          }),
        },
      },
    };
    mocks.getClientContext.mockResolvedValue({ octokit });
    mocks.prisma.analysis.findFirst.mockResolvedValue(null);

    const result = await executeChangelogWriter(
      "analysis-1",
      makeAnalysisResult(),
      1,
      makeRepo(),
      "English",
    );

    expect(result.name).toBe("changelog");
    expect(result.status).toBe("llm");

    // Inspect what was passed to buildChangelogWriterUserPrompt
    const callArg = mocks.buildChangelogWriterUserPrompt.mock.calls[0]![0] as {
      commitsJson: string;
      pullRequestsJson: string;
    };
    expect(callArg.commitsJson).toContain("alice");
    expect(callArg.commitsJson).toContain("fix typo");
    expect(callArg.pullRequestsJson).toContain("PR-5");
    expect(callArg.pullRequestsJson).toContain("bug");
    expect(callArg.pullRequestsJson).toContain("alice");
    // Unmerged PR should be filtered out
    expect(callArg.pullRequestsJson).not.toContain("Unmerged");
  });

  it("uses compareCommits when previous analysis has commitSha", async () => {
    const octokit = {
      rest: {
        repos: {
          compareCommits: vi.fn().mockResolvedValue({
            data: {
              commits: [
                { commit: { author: { name: "bob" }, message: "feat: add auth" } },
                { commit: { author: { name: "bob" }, message: "chore: deps" } },
              ],
              files: [
                { changes: 10, filename: "src/index.ts" },
                { changes: 2, filename: "src/util.ts" },
              ],
            },
          }),
        },
        search: {
          issuesAndPullRequests: vi.fn().mockResolvedValue({
            data: {
              items: [
                {
                  labels: [{ name: "enhancement" }],
                  number: 10,
                  title: "Feature",
                  user: { login: "bob" },
                },
              ],
            },
          }),
        },
      },
    };
    mocks.getClientContext.mockResolvedValue({ octokit });
    mocks.prisma.analysis.findFirst.mockResolvedValue({
      commitSha: "abc123",
      createdAt: new Date("2024-01-01"),
    });

    await executeChangelogWriter("analysis-1", makeAnalysisResult(), 1, makeRepo(), "English");

    expect(octokit.rest.repos.compareCommits).toHaveBeenCalled();
    expect(octokit.rest.search.issuesAndPullRequests).toHaveBeenCalled();

    const callArg = mocks.buildChangelogWriterUserPrompt.mock.calls[0]![0] as {
      analysisDeltaJson: string;
      commitsJson: string;
      pullRequestsJson: string;
    };
    const delta = JSON.parse(callArg.analysisDeltaJson) as {
      diff_summary: { top_modified_files: string[] };
    };
    expect(delta.diff_summary.top_modified_files).toEqual(["src/index.ts", "src/util.ts"]);
    expect(callArg.commitsJson).toContain("feat: add auth");
    expect(callArg.pullRequestsJson).toContain("PR-10");
  });

  it("handles rich-git fetch failure gracefully", async () => {
    mocks.getClientContext.mockRejectedValue(new Error("network"));
    mocks.prisma.analysis.findFirst.mockResolvedValue(null);

    const result = await executeChangelogWriter(
      "analysis-1",
      makeAnalysisResult(),
      1,
      makeRepo(),
      "English",
    );

    expect(mocks.appLogger.warn).toHaveBeenCalled();
    expect(result.name).toBe("changelog");
    // Writer still ran — buildChangelogWriterUserPrompt still called
    expect(mocks.buildChangelogWriterUserPrompt).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// runWriterTask failure and edge cases
// ---------------------------------------------------------------------------
describe("runWriterTask error handling", () => {
  it("returns failed status on callWithFallback rejection", async () => {
    mocks.callWithFallback.mockRejectedValue(new Error("nope"));

    const result = await executeReadmeWriter(
      baseArgs.analysisId,
      baseArgs.payload,
      baseArgs.engineeringDossierPayload,
      baseArgs.context,
      "allowed",
      baseArgs.language,
      baseArgs.repoId,
      baseArgs.userId,
      baseArgs.branch,
    );

    expect(result.name).toBe("readme");
    expect(result.status).toBe("failed");
    expect(result.error).toBe("nope");
    expect(mocks.appLogger.warn).toHaveBeenCalled();
  });

  it("returns missing status for empty content", async () => {
    mocks.callWithFallback.mockResolvedValue("");
    mocks.unwrapAiText.mockReturnValue("");

    const result = await executeReadmeWriter(
      baseArgs.analysisId,
      baseArgs.payload,
      baseArgs.engineeringDossierPayload,
      baseArgs.context,
      "allowed",
      baseArgs.language,
      baseArgs.repoId,
      baseArgs.userId,
      baseArgs.branch,
    );

    expect(result.name).toBe("readme");
    expect(result.status).toBe("missing");
    expect(result.content).toBe("");
  });
});
