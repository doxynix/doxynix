import type { Repo } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

const { trackMock, userBatchMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
  userBatchMock: vi.fn(),
}));

vi.mock("@/server/core/posthog-events", () => ({ trackServerEvent: trackMock }));

vi.mock("@trigger.dev/sdk", () => ({
  auth: {},
  metadata: { append: vi.fn(), current: () => undefined, set: vi.fn() },
  runs: {},
  tasks: { trigger: vi.fn() },
}));

vi.mock("@/server/core/entitlements", () => ({
  assertAnalysisAllowed: vi.fn(),
  getWorkspaceEntitlement: vi.fn(),
}));

vi.mock("@/server/core/github/github-api", () => ({ getBranchHeadSha: vi.fn() }));

vi.mock("@/server/core/usage/usage", () => ({
  recordAnalysisUsage: vi.fn(),
  recordCacheHitUsage: vi.fn(),
  releaseAnalysisUsage: vi.fn(),
}));

vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: () => ({ publish: vi.fn() }), userBatch: userBatchMock },
}));

vi.mock("./doc-sync.service", () => ({
  docSyncService: { autoSyncDocsToGithub: vi.fn().mockResolvedValue(null) },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
  analysis: { update: vi.fn() },
  document: { upsert: vi.fn() },
  notification: { create: vi.fn() },
  user: { updateMany: vi.fn() },
}));

vi.mock("@/server/core/db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return { ...actual, prisma: prismaMock };
});

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import defaultAiResult from "../fixtures/default-ai-result.json";
import defaultMetrics from "../fixtures/default-metrics.json";
import { analysisLifecycleService } from "./analysis-lifecycle.service";

const repo = {
  id: "repo-1",
  name: "demo",
  owner: "acme",
  pushedAt: new Date(),
  updatedAt: new Date(),
  workspaceId: "workspace-1",
} as unknown as Repo;

const notification = { id: "notification-1", title: "Analysis for acme/demo ready" };

function buildParams() {
  return {
    aiResult: defaultAiResult as unknown as AIResult,
    analysisId: "analysis-1",
    busFactor: 1,
    channelName: "user:user-1",
    currentSha: "sha-1",
    generatedDocsData: {
      generatedApiMarkdown: "# API",
      generatedArchitecture: "# Architecture",
      generatedChangelog: "# Changelog",
      generatedContributing: "# Contributing",
      generatedReadme: "# Readme",
    },
    hardMetrics: defaultMetrics as unknown as RepoMetrics,
    rawContributors: [{ contributions: 3, login: "octocat" }],
    repo,
    repositoryFacts: [],
    repositoryFindings: [],
    userId: "user-1",
    workspaceId: "workspace-1",
  };
}

describe("analysisLifecycleService.saveResults realtime batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.analysis.update.mockResolvedValue({ id: "analysis-1" });
    prismaMock.document.upsert.mockResolvedValue({});
    prismaMock.notification.create.mockResolvedValue(notification);
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
  });

  it("batches the notification and the completion event", async () => {
    await analysisLifecycleService.saveResults(buildParams());

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        body: expect.stringMatching(/^Health Score: \d+\/100$/),
        repoId: "repo-1",
        title: "Analysis for acme/demo ready",
        type: "SUCCESS",
        userId: "user-1",
      },
    });
    expect(userBatchMock).toHaveBeenCalledTimes(1);
    expect(userBatchMock).toHaveBeenCalledWith("user-1", [
      {
        data: { id: notification.id, title: notification.title },
        name: REALTIME_CONFIG.events.user.notification,
      },
      { data: {}, name: REALTIME_CONFIG.events.user.analysisUpdated },
    ]);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("puts the activation event first when the run activates the user", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

    await analysisLifecycleService.saveResults(buildParams());

    expect(userBatchMock).toHaveBeenCalledWith("user-1", [
      { data: {}, name: REALTIME_CONFIG.events.user.userUpdated },
      {
        data: { id: notification.id, title: notification.title },
        name: REALTIME_CONFIG.events.user.notification,
      },
      { data: {}, name: REALTIME_CONFIG.events.user.analysisUpdated },
    ]);
    expect(trackMock).toHaveBeenCalledWith(
      "onboarding_activated",
      { analysis_id: "analysis-1", repo_id: "repo-1" },
      "user-1",
    );
  });
});
