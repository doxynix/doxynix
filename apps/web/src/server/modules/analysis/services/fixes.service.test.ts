import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFix: vi.fn(),
  getByRepoId: vi.fn(),
  publish: vi.fn(),
  trigger: vi.fn(),
}));

vi.mock("@/server/core/github/github-client", () => ({
  getClientContext: vi.fn(),
  getInstallationClient: vi.fn(),
}));
vi.mock("@/server/core/realtime", () => ({
  realtimeService: { user: () => ({ publish: mocks.publish }) },
}));
vi.mock("../analysis.repository", () => ({
  analysisRepo: { create: mocks.createFix, getByRepoId: mocks.getByRepoId },
}));
vi.mock("../tasks/generate-fix.task", () => ({
  generateFixTask: { trigger: mocks.trigger },
}));

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import type { DbClient } from "@/server/core/db";

import { fixesService } from "./fixes.service";

const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";
const PR_ANALYSIS_ID = "018f0000-0000-7000-8000-0000000000aa";
const FIX_ID = "018f0000-0000-7000-8000-0000000000bb";

function gatedDb(order: string[]) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  async function gated(name: string, value: unknown) {
    order.push(name);
    if (order.length === 2) {
      release();
    }
    await gate;
    return value;
  }

  return {
    pullRequestAnalysis: { findFirst: () => gated("prAnalysis", { id: PR_ANALYSIS_ID }) },
    repo: { findUnique: () => gated("repo", { id: REPO_ID, owner: "ivan" }) },
  } as unknown as DbClient;
}

function simpleDb(prAnalysis: unknown, repo: unknown) {
  return {
    pullRequestAnalysis: { findFirst: vi.fn().mockResolvedValue(prAnalysis) },
    repo: { findUnique: vi.fn().mockResolvedValue(repo) },
  } as unknown as DbClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.publish.mockResolvedValue(undefined);
  mocks.createFix.mockResolvedValue({ id: FIX_ID });
  mocks.trigger.mockResolvedValue({ id: "run-1" });
});

describe("fixesService.createFix", () => {
  it("validates the PR analysis and reads the repo concurrently", async () => {
    const order: string[] = [];

    const result = await fixesService.createFix(
      gatedDb(order),
      "user-1",
      { fileContents: {}, findings: [], prAnalysisId: PR_ANALYSIS_ID, repoId: REPO_ID },
      "workspace-1",
    );

    // The gate opens only once both reads are in flight, so a sequential body would hang.
    expect(order.sort()).toEqual(["prAnalysis", "repo"]);
    expect(result).toStrictEqual({ fixId: FIX_ID, status: "PENDING", success: true });
    expect(mocks.publish).toHaveBeenCalledWith(REALTIME_CONFIG.events.user.stagingUpdated, {});
  });

  it("nulls the FK when the PR analysis does not belong to the workspace", async () => {
    await fixesService.createFix(
      simpleDb(null, { id: REPO_ID, owner: "ivan" }),
      "user-1",
      { fileContents: {}, findings: [], prAnalysisId: PR_ANALYSIS_ID, repoId: REPO_ID },
      "workspace-1",
    );

    expect(mocks.createFix).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ prAnalysisId: undefined }),
    );
    expect(mocks.trigger.mock.calls[0]?.[0]).toMatchObject({ prAnalysisId: undefined });
  });

  it("still fails when the repository is missing", async () => {
    await expect(
      fixesService.createFix(
        simpleDb({ id: PR_ANALYSIS_ID }, null),
        "user-1",
        { fileContents: {}, findings: [], repoId: REPO_ID },
        "workspace-1",
      ),
    ).resolves.toMatchObject({ error: "Repository not found", success: false });
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("does not read the PR analysis when the caller sent no id", async () => {
    const db = simpleDb(null, { id: REPO_ID, owner: "ivan" });

    await fixesService.createFix(
      db,
      "user-1",
      { fileContents: {}, findings: [], repoId: REPO_ID },
      "workspace-1",
    );

    expect(db.pullRequestAnalysis.findFirst).not.toHaveBeenCalled();
  });
});

describe("fixesService.getByRepository", () => {
  function fixRow(id: string) {
    return {
      branch: `fix/${id}`,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      description: null,
      estimatedImpact: null,
      githubPrNumber: null,
      githubPrUrl: null,
      id,
      status: "DRAFT",
      title: id,
    };
  }

  it("keeps the page and hands the probe row back as the next cursor", async () => {
    mocks.getByRepoId.mockResolvedValue([fixRow("fix-1"), fixRow("fix-2"), fixRow("fix-3")]);

    const page = await fixesService.getByRepository(
      {} as unknown as DbClient,
      REPO_ID,
      "workspace-1",
      { limit: 2 },
    );

    expect(page.items.map((fix) => fix.id)).toEqual(["fix-1", "fix-2"]);
    expect(page.meta).toStrictEqual({ hasNextPage: true, nextCursor: "fix-3" });
  });

  it("reports the last page without a cursor", async () => {
    mocks.getByRepoId.mockResolvedValue([fixRow("fix-1")]);

    const page = await fixesService.getByRepository(
      {} as unknown as DbClient,
      REPO_ID,
      "workspace-1",
      { cursor: "fix-0", limit: 2 },
    );

    expect(page.meta).toStrictEqual({ hasNextPage: false, nextCursor: undefined });
    expect(mocks.getByRepoId).toHaveBeenCalledWith(expect.anything(), REPO_ID, "workspace-1", {
      cursor: "fix-0",
      limit: 2,
    });
  });
});
