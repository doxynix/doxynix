import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

const { trackMock, triggerMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
  triggerMock: vi.fn(),
}));

vi.mock("@/server/core/posthog-events", () => ({
  trackServerEvent: trackMock,
}));

vi.mock("@trigger.dev/sdk", () => ({
  auth: {},
  runs: {},
  tasks: { trigger: triggerMock },
}));

vi.mock("@/server/core/entitlements", () => ({
  assertAnalysisAllowed: vi.fn(),
  getWorkspaceEntitlement: vi.fn().mockResolvedValue({ hasAccess: true }),
}));

vi.mock("@/server/core/github/github-api", () => ({
  getBranchHeadSha: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/core/usage/usage", () => ({
  recordAnalysisUsage: vi.fn().mockResolvedValue(undefined),
  recordCacheHitUsage: vi.fn().mockResolvedValue(undefined),
  releaseAnalysisUsage: vi.fn().mockResolvedValue(undefined),
}));

const prismaMock = vi.hoisted(() => ({
  $executeRaw: vi.fn().mockResolvedValue(0),
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
}));

vi.mock("@/server/core/db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return { ...actual, prisma: prismaMock };
});

import { AppError } from "@/server/core/api-error";
import { assertAnalysisAllowed } from "@/server/core/entitlements";
import { releaseAnalysisUsage } from "@/server/core/usage/usage";

import { analysisLifecycleService } from "./analysis-lifecycle.service";

function buildDb(): DbClient {
  return {
    analysis: {
      create: vi.fn().mockResolvedValue({ id: "analysis-1" }),
      update: vi.fn().mockResolvedValue({ id: "analysis-1" }),
    },
    repo: {
      findFirst: vi.fn().mockResolvedValue({
        defaultBranch: "main",
        id: "repo-1",
        name: "demo",
        owner: "acme",
        workspaceId: "workspace-1",
      }),
    },
  } as unknown as DbClient;
}

describe("analysisLifecycleService.analyze analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    triggerMock.mockResolvedValue({ id: "handle-1", publicAccessToken: "tok" });
  });

  it("tracks repo_analysis_queued with the analysis id and the caller's user", async () => {
    await analysisLifecycleService.analyze(buildDb(), "user-1", "workspace-1", {
      branch: "main",
      docTypes: ["API", "README"],
      files: ["a.ts", "b.ts"],
      instructions: "be brief",
      language: "en",
      repoId: "repo-1",
    });

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      "repo_analysis_queued",
      {
        analysis_id: "analysis-1",
        doc_types_count: 2,
        has_custom_instructions: true,
        language: "en",
        selected_branch: "main",
        selected_files_count: 2,
      },
      "user-1",
    );
  });

  it("nulls the branch and reports no custom instructions when omitted", async () => {
    await analysisLifecycleService.analyze(buildDb(), "user-2", "workspace-1", {
      docTypes: [],
      files: [],
      language: "ru",
      repoId: "repo-1",
    });

    expect(trackMock).toHaveBeenCalledWith(
      "repo_analysis_queued",
      expect.objectContaining({
        has_custom_instructions: false,
        selected_branch: null,
        selected_files_count: 0,
      }),
      "user-2",
    );
  });

  it("does not release a unit that was never reserved", async () => {
    vi.mocked(assertAnalysisAllowed).mockImplementationOnce(() => {
      throw new AppError({ code: "FORBIDDEN", publicMessage: "LIMIT_EXCEEDED" });
    });
    const db = buildDb();

    await expect(
      analysisLifecycleService.analyze(db, "user-1", "workspace-1", {
        docTypes: [],
        files: [],
        language: "en",
        repoId: "repo-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(db.analysis.create).not.toHaveBeenCalled();
    expect(triggerMock).not.toHaveBeenCalled();
    // A rejected request never took a unit, so releasing one would make the quota porous.
    expect(releaseAnalysisUsage).not.toHaveBeenCalled();
  });

  it("returns the reserved unit when the queue call fails", async () => {
    triggerMock.mockRejectedValueOnce(new Error("trigger down"));
    const db = buildDb();

    await expect(
      analysisLifecycleService.analyze(db, "user-1", "workspace-1", {
        docTypes: [],
        files: [],
        language: "en",
        repoId: "repo-1",
      }),
    ).rejects.toThrow("trigger down");

    expect(releaseAnalysisUsage).toHaveBeenCalled();
  });

  it("does not track when repository access is denied", async () => {
    const db = buildDb();
    vi.mocked(db.repo.findFirst).mockResolvedValue(null);

    await expect(
      analysisLifecycleService.analyze(db, "user-1", "workspace-1", {
        docTypes: [],
        files: [],
        language: "en",
        repoId: "missing",
      }),
    ).rejects.toThrow("Repository not found or access denied");

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("reads only the repo columns the access check needs", async () => {
    const db = buildDb();

    await analysisLifecycleService.assertRepoAccess(db, "workspace-1", "repo-1");

    expect(db.repo.findFirst).toHaveBeenCalledWith({
      select: { defaultBranch: true, id: true, name: true, owner: true, workspaceId: true },
      where: { id: "repo-1", workspaceId: "workspace-1" },
    });
  });

  it("does not track when the task could not be triggered", async () => {
    triggerMock.mockRejectedValue(new Error("queue unavailable"));

    await expect(
      analysisLifecycleService.analyze(buildDb(), "user-1", "workspace-1", {
        docTypes: [],
        files: [],
        language: "en",
        repoId: "repo-1",
      }),
    ).rejects.toThrow("queue unavailable");

    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe("analysisLifecycleService.getHistory", () => {
  const WORKSPACE_ID = "workspace-1";
  const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";

  function makeHistoryRow(overrides?: Record<string, unknown>) {
    return {
      commitSha: "abc1234",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      id: "018f0000-0000-7000-8000-000000000001",
      message: "Completed successfully",
      score: 88,
      status: "DONE",
      ...overrides,
    };
  }

  function buildHistoryDb(rows: unknown[], total = rows.length) {
    const count = vi.fn().mockResolvedValue(total);
    const findMany = vi.fn().mockResolvedValue(rows);
    const db = { analysis: { count, findMany } } as unknown as DbClient;

    return { count, db, findMany };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads one probe row past the page in the newest-first order", async () => {
    const { db, findMany } = buildHistoryDb([
      makeHistoryRow({ id: "018f0000-0000-7000-8000-00000000000a" }),
      makeHistoryRow({ id: "018f0000-0000-7000-8000-00000000000b" }),
      makeHistoryRow({ id: "018f0000-0000-7000-8000-00000000000c" }),
    ]);

    const result = await analysisLifecycleService.getHistory(db, REPO_ID, WORKSPACE_ID, {
      limit: 2,
    });

    expect(result.items.map((item) => item.id)).toStrictEqual([
      "018f0000-0000-7000-8000-00000000000a",
      "018f0000-0000-7000-8000-00000000000b",
    ]);
    expect(result.meta).toStrictEqual({
      hasNextPage: true,
      nextCursor: "018f0000-0000-7000-8000-00000000000c",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: undefined,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
        where: { repo: { id: REPO_ID, workspaceId: WORKSPACE_ID } },
      }),
    );
  });

  it("keysets past the cursor id", async () => {
    const { db, findMany } = buildHistoryDb([makeHistoryRow()]);
    const cursor = "018f0000-0000-7000-8000-00000000000b";

    await analysisLifecycleService.getHistory(db, REPO_ID, WORKSPACE_ID, { cursor, limit: 2 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: cursor }, take: 3 }),
    );
  });

  it("reports the last page without a cursor when the probe row is missing", async () => {
    const { db } = buildHistoryDb([makeHistoryRow()]);

    const result = await analysisLifecycleService.getHistory(db, REPO_ID, WORKSPACE_ID, {
      limit: 2,
    });

    expect(result.meta).toStrictEqual({ hasNextPage: false, nextCursor: undefined });
  });

  it("keeps the total from the count query independent of the page", async () => {
    const { count, db } = buildHistoryDb([makeHistoryRow()], 620);

    const result = await analysisLifecycleService.getHistory(db, REPO_ID, WORKSPACE_ID, {
      limit: 50,
    });

    expect(result.total).toBe(620);
    expect(count).toHaveBeenCalledWith({
      where: { repo: { id: REPO_ID, workspaceId: WORKSPACE_ID } },
    });
  });
});
