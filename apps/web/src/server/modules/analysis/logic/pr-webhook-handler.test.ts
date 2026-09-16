import type { PullRequestEvent } from "@octokit/webhooks-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analysisRepo: {
    createPRAnalysis: vi.fn(),
    getByRepoAndPRNumber: vi.fn(),
    updatePRAnalysis: vi.fn(),
  },
  analyzePrTask: { trigger: vi.fn() },
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  PRConfigService: { getConfig: vi.fn() },
  prisma: { repo: { findFirst: vi.fn() } },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/modules/analysis/logic/pr-config", () => ({
  PRConfigService: mocks.PRConfigService,
}));
vi.mock("../analysis.repository", () => ({ analysisRepo: mocks.analysisRepo }));
vi.mock("../tasks/analyze-pr.task", () => ({ analyzePrTask: mocks.analyzePrTask }));

import { handlePullRequestEvent } from "./pr-webhook-handler";

function makePullRequestEvent(
  action: string,
  overrides: Partial<PullRequestEvent> = {},
): PullRequestEvent {
  const defaultUser = {
    avatar_url: "x",
    events_url: "x",
    followers_url: "x",
    following_url: "x",
    gists_url: "x",
    gravatar_id: null,
    html_url: "x",
    id: 1,
    login: "dev",
    node_id: "n",
    organizations_url: "x",
    received_events_url: "x",
    repos_url: "x",
    site_admin: false,
    starred_url: "x",
    subscriptions_url: "x",
    type: "User" as const,
    url: "x",
  };
  const prDefaults = {
    base: {
      ref: "main",
      repo: { name: "repo" },
      sha: "base-sha",
    } as unknown as PullRequestEvent["pull_request"]["base"],
    draft: false,
    head: {
      ref: "feat",
      sha: "head-sha",
    } as unknown as PullRequestEvent["pull_request"]["head"],
    html_url: "https://github.com/owner/repo/pull/42",
    id: 42,
    number: 42,
    state: "open",
    title: "PR",
    user: defaultUser,
  };
  const { pull_request: prOverrides, ...restOverrides } = overrides;
  return {
    action,
    number: 42,
    pull_request: {
      ...prDefaults,
      ...prOverrides,
    } as unknown as PullRequestEvent["pull_request"],
    repository: {
      default_branch: "main",
      full_name: "owner/repo",
      html_url: "https://github.com/owner/repo",
      id: 987,
      name: "repo",
      node_id: "n",
      owner: {
        avatar_url: null,
        email: null,
        events_url: "",
        followers_url: "",
        following_url: "",
        gists_url: "",
        gravatar_id: null,
        html_url: "",
        id: 7,
        login: "owner",
        name: null,
        node_id: "",
        organizations_url: "",
        received_events_url: "",
        repos_url: "",
        site_admin: false,
        starred_url: "",
        subscriptions_url: "",
        type: "User",
        url: "",
      },
      private: false,
    } as unknown as PullRequestEvent["repository"],
    sender: null as unknown as PullRequestEvent["sender"],
    ...restOverrides,
  } as unknown as PullRequestEvent;
}

describe("handlePullRequestEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores bot users without calling prisma", async () => {
    const evt = makePullRequestEvent("opened", {
      pull_request: {
        user: { login: "dependabot[bot]", type: "Bot" },
      } as unknown as PullRequestEvent["pull_request"],
    });

    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();
    expect(mocks.appLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_webhook_ignored_bot" }),
    );
    expect(mocks.prisma.repo.findFirst).not.toHaveBeenCalled();
  });

  it("skips draft PRs without calling prisma", async () => {
    const evt = makePullRequestEvent("opened", {
      pull_request: { draft: true } as unknown as PullRequestEvent["pull_request"],
    });

    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();
    expect(mocks.appLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_webhook_skipped_draft" }),
    );
    expect(mocks.prisma.repo.findFirst).not.toHaveBeenCalled();
  });

  it("ignores unsupported actions like 'closed'", async () => {
    const evt = makePullRequestEvent("closed");

    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();
    expect(mocks.appLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_webhook_ignored" }),
    );
    expect(mocks.prisma.repo.findFirst).not.toHaveBeenCalled();
  });

  it("warns when repo is not found in database", async () => {
    mocks.prisma.repo.findFirst.mockResolvedValue(null);
    const evt = makePullRequestEvent("opened");

    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();
    expect(mocks.prisma.repo.findFirst).toHaveBeenCalledWith({
      where: { githubId: 987 },
    });
    expect(mocks.appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_webhook_repo_not_found" }),
    );
    expect(mocks.analyzePrTask.trigger).not.toHaveBeenCalled();
  });

  it("skips analysis when config is disabled", async () => {
    mocks.prisma.repo.findFirst.mockResolvedValue({ id: 1, publicId: "pub-1" });
    mocks.PRConfigService.getConfig.mockResolvedValue({ enabled: false });
    const evt = makePullRequestEvent("opened");

    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();
    expect(mocks.appLogger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_webhook_analysis_disabled" }),
    );
    expect(mocks.analyzePrTask.trigger).not.toHaveBeenCalled();
  });

  it("creates analysis and triggers on 'opened' with no existing analysis", async () => {
    mocks.prisma.repo.findFirst.mockResolvedValue({ id: 1, publicId: "pub-1" });
    mocks.PRConfigService.getConfig.mockResolvedValue({ enabled: true });
    mocks.analysisRepo.getByRepoAndPRNumber.mockResolvedValue(null);
    mocks.analysisRepo.createPRAnalysis.mockResolvedValue({ id: 55 });

    const evt = makePullRequestEvent("opened");
    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();

    expect(mocks.analysisRepo.createPRAnalysis).toHaveBeenCalledWith(
      mocks.prisma,
      expect.objectContaining({
        owner: "owner",
        prNumber: 42,
        repoId: "pub-1",
        repoName: "repo",
      }),
    );
    expect(mocks.analyzePrTask.trigger).toHaveBeenCalledWith(
      expect.objectContaining({ analysisId: 55, prNumber: 42, repoId: 1 }),
    );
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_webhook_analysis_created" }),
    );
  });

  it("updates existing analysis on 'synchronize' and triggers", async () => {
    mocks.prisma.repo.findFirst.mockResolvedValue({ id: 1, publicId: "pub-1" });
    mocks.PRConfigService.getConfig.mockResolvedValue({ enabled: true });
    mocks.analysisRepo.getByRepoAndPRNumber.mockResolvedValue({ id: 77 });
    mocks.analysisRepo.updatePRAnalysis.mockResolvedValue({ id: 77 });

    const evt = makePullRequestEvent("synchronize");
    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();

    expect(mocks.analysisRepo.updatePRAnalysis).toHaveBeenCalledWith(
      mocks.prisma,
      77,
      expect.objectContaining({ baseSha: "base-sha", headSha: "head-sha" }),
    );
    expect(mocks.analysisRepo.createPRAnalysis).not.toHaveBeenCalled();
    expect(mocks.analyzePrTask.trigger).toHaveBeenCalledWith(
      expect.objectContaining({ analysisId: 77 }),
    );
  });

  it("does not trigger when existing analysis found on 'opened'", async () => {
    mocks.prisma.repo.findFirst.mockResolvedValue({ id: 1, publicId: "pub-1" });
    mocks.PRConfigService.getConfig.mockResolvedValue({ enabled: true });
    mocks.analysisRepo.getByRepoAndPRNumber.mockResolvedValue({ id: 77 });

    const evt = makePullRequestEvent("opened");
    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();

    expect(mocks.analyzePrTask.trigger).not.toHaveBeenCalled();
    expect(mocks.appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_webhook_analysis_already_exists" }),
    );
  });

  it("catches errors and logs pr_webhook_error", async () => {
    mocks.prisma.repo.findFirst.mockRejectedValue(new Error("db down"));
    const evt = makePullRequestEvent("opened");

    await expect(handlePullRequestEvent(evt)).resolves.toBeUndefined();
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "pr_webhook_error" }),
    );
    expect(mocks.analyzePrTask.trigger).not.toHaveBeenCalled();
  });
});
