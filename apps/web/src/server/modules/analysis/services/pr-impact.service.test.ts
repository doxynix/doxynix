import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildAffectedNodes: vi.fn(() => []),
  buildAffectedZones: vi.fn(() => []),
  buildTopFindings: vi.fn(async () => []),
  buildTopLevelNodes: vi.fn(() => []),
  countFindingsByFile: vi.fn(() => new Map<string, number>()),
  createAnalyzeContextBuilder: vi.fn(() => ({
    getStructureContext: () => null,
    getStructureNode: vi.fn(() => null),
  })),
  getRepoBySha: vi.fn(),
  getRepoSnapshot: vi.fn(),
  loadImpactAnalysis: vi.fn(),
  loadLegacyComments: vi.fn(),
  mapChangedFilesToImpactNodes: vi.fn(() => []),
  parseChangedFilesSnapshot: vi.fn((_analysis: unknown, _legacyComments?: unknown) => []),
  parsePersistedFindings: vi.fn((_analysis: unknown, _legacyComments?: unknown) => []),
  selectPrimaryFile: vi.fn(() => null),
}));

vi.mock("../analysis.mapper", () => ({
  analysisMapper: {
    buildAffectedNodes: mocks.buildAffectedNodes,
    buildAffectedZones: mocks.buildAffectedZones,
    buildTopFindings: mocks.buildTopFindings,
    countFindingsByFile: mocks.countFindingsByFile,
    parseChangedFilesSnapshot: mocks.parseChangedFilesSnapshot,
    parsePersistedFindings: mocks.parsePersistedFindings,
    selectPrimaryFile: mocks.selectPrimaryFile,
  },
}));
vi.mock("../analysis.repository", () => ({
  analysisRepo: {
    getRepoBySha: mocks.getRepoBySha,
    getRepoSnapshot: mocks.getRepoSnapshot,
    loadImpactAnalysis: mocks.loadImpactAnalysis,
    loadLegacyComments: mocks.loadLegacyComments,
  },
}));
vi.mock("../logic/analyze-context-builder", () => ({
  createAnalyzeContextBuilder: mocks.createAnalyzeContextBuilder,
}));
vi.mock("../logic/graph-navigator", () => ({ buildTopLevelNodes: mocks.buildTopLevelNodes }));
vi.mock("../logic/impact-file-mapper", () => ({
  mapChangedFilesToImpactNodes: mocks.mapChangedFilesToImpactNodes,
}));

import type { DbClient } from "@/server/core/db";

import { prImpactService } from "./pr-impact.service";

const ANALYSIS_ID = "018f0000-0000-7000-8000-0000000000aa";
const UPDATED_AT = new Date("2026-03-01T12:00:00.000Z");
const REPO_ID = "018f0000-0000-7000-8000-0000000000cc";

function stubAnalysis() {
  return {
    _count: { generatedFixes: 0 },
    baseSha: "base",
    changedFilesJson: [],
    createdAt: new Date("2026-03-01T11:00:00.000Z"),
    findingsJson: [],
    generatedFixes: [],
    headSha: "head",
    id: ANALYSIS_ID,
    prNumber: 7,
    riskScore: null,
    status: "COMPLETED",
    updatedAt: UPDATED_AT,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadLegacyComments.mockResolvedValue([]);
});

describe("prImpactService.getByRepoAndPRNumber", () => {
  it("hands the findings cache the analysis id and its version separately", async () => {
    mocks.loadImpactAnalysis.mockResolvedValue(stubAnalysis());
    mocks.getRepoBySha.mockResolvedValue({ name: "doxynix", owner: "ivan" });

    const payload = await prImpactService.getByRepoAndPRNumber({} as DbClient, REPO_ID, 7, "ws-1");

    expect(mocks.buildTopFindings).toHaveBeenCalledTimes(1);
    expect(mocks.buildTopFindings).toHaveBeenCalledWith(
      [],
      [],
      expect.any(Map),
      "ivan",
      "doxynix",
      { analysisId: ANALYSIS_ID, version: String(UPDATED_AT.getTime()) },
    );
    expect(payload).not.toBeNull();
    expect(payload?.analysis.id).toBe(ANALYSIS_ID);
  });

  it("reports the counted fixes while building the capped page", async () => {
    mocks.loadImpactAnalysis.mockResolvedValue({
      ...stubAnalysis(),
      _count: { generatedFixes: 137 },
      generatedFixes: [
        {
          githubPrNumber: 12,
          githubPrUrl: "https://pr/12",
          id: "fix-1",
          status: "DRAFT",
          title: "a",
        },
        { githubPrNumber: null, githubPrUrl: null, id: "fix-2", status: "COMPLETED", title: "b" },
      ],
    });
    mocks.getRepoBySha.mockResolvedValue({ name: "doxynix", owner: "ivan" });

    const payload = await prImpactService.getByRepoAndPRNumber({} as DbClient, REPO_ID, 7, "ws-1");

    expect(payload?.summary.linkedFixes).toBe(137);
    expect(payload?.fixes.map((fix) => fix.id)).toStrictEqual(["fix-1", "fix-2"]);
  });

  it("skips the legacy comment query when both json snapshots are present", async () => {
    mocks.loadImpactAnalysis.mockResolvedValue(stubAnalysis());
    mocks.getRepoBySha.mockResolvedValue({ name: "doxynix", owner: "ivan" });

    await prImpactService.getByRepoAndPRNumber({} as DbClient, REPO_ID, 7, "ws-1");

    expect(mocks.loadLegacyComments).not.toHaveBeenCalled();
    expect(mocks.parseChangedFilesSnapshot.mock.calls[0]?.[1]).toBeUndefined();
    expect(mocks.parsePersistedFindings.mock.calls[0]?.[1]).toBeUndefined();
  });

  it("loads the legacy comments once for a row with a missing json snapshot", async () => {
    const legacy = [
      { body: "b", filePath: "src/a.ts", findingType: "BUG", id: "c1", line: 1, riskLevel: 7 },
    ];
    mocks.loadImpactAnalysis.mockResolvedValue({
      ...stubAnalysis(),
      changedFilesJson: null,
      findingsJson: null,
    });
    mocks.loadLegacyComments.mockResolvedValue(legacy);
    mocks.getRepoBySha.mockResolvedValue({ name: "doxynix", owner: "ivan" });

    await prImpactService.getByRepoAndPRNumber({} as DbClient, REPO_ID, 7, "ws-1");

    expect(mocks.loadLegacyComments).toHaveBeenCalledTimes(1);
    expect(mocks.loadLegacyComments).toHaveBeenCalledWith(expect.anything(), ANALYSIS_ID, "ws-1");
    expect(mocks.parseChangedFilesSnapshot.mock.calls[0]?.[1]).toStrictEqual(legacy);
    expect(mocks.parsePersistedFindings.mock.calls[0]?.[1]).toStrictEqual(legacy);
  });

  it("returns null when the analysis or the repo snapshot is missing", async () => {
    mocks.loadImpactAnalysis.mockResolvedValue(null);

    await expect(
      prImpactService.getByRepoAndPRNumber({} as DbClient, REPO_ID, 7, "ws-1"),
    ).resolves.toBeNull();

    mocks.loadImpactAnalysis.mockResolvedValue(stubAnalysis());
    mocks.getRepoBySha.mockResolvedValue(null);
    mocks.getRepoSnapshot.mockResolvedValue(null);

    await expect(
      prImpactService.getByRepoAndPRNumber({} as DbClient, REPO_ID, 7, "ws-1"),
    ).resolves.toBeNull();
    expect(mocks.buildTopFindings).not.toHaveBeenCalled();
  });
});

describe("prImpactService.listByRepository", () => {
  const WORKSPACE_ID = "ws-1";

  function makePullRow(overrides?: Record<string, unknown>) {
    return {
      _count: { comments: 2 },
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      headSha: "head-sha-1",
      id: "018f0000-0000-7000-8000-000000000001",
      prNumber: 42,
      riskScore: 5,
      status: "COMPLETED",
      ...overrides,
    };
  }

  function buildPullDb(rows: unknown[], total = rows.length) {
    const count = vi.fn().mockResolvedValue(total);
    const findMany = vi.fn().mockResolvedValue(rows);
    const db = { pullRequestAnalysis: { count, findMany } } as unknown as DbClient;

    return { count, db, findMany };
  }

  it("reads one probe row past the page in the newest-first order", async () => {
    const { db, findMany } = buildPullDb([
      makePullRow({ id: "018f0000-0000-7000-8000-00000000000a" }),
      makePullRow({ id: "018f0000-0000-7000-8000-00000000000b" }),
      makePullRow({ id: "018f0000-0000-7000-8000-00000000000c" }),
    ]);

    const result = await prImpactService.listByRepository(db, REPO_ID, WORKSPACE_ID, { limit: 2 });

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
    const { db, findMany } = buildPullDb([makePullRow()]);
    const cursor = "018f0000-0000-7000-8000-00000000000b";

    await prImpactService.listByRepository(db, REPO_ID, WORKSPACE_ID, { cursor, limit: 2 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: cursor }, take: 3 }),
    );
  });

  it("reports the last page without a cursor when the probe row is missing", async () => {
    const { db } = buildPullDb([makePullRow()]);

    const result = await prImpactService.listByRepository(db, REPO_ID, WORKSPACE_ID, { limit: 2 });

    expect(result.meta).toStrictEqual({ hasNextPage: false, nextCursor: undefined });
  });

  it("keeps the comment count mapping and the total from the count query", async () => {
    const { db } = buildPullDb([makePullRow({ _count: { comments: 7 } })], 620);

    const result = await prImpactService.listByRepository(db, REPO_ID, WORKSPACE_ID, { limit: 50 });

    expect(result.items[0]?.findingCount).toBe(7);
    expect(result.total).toBe(620);
  });
});
