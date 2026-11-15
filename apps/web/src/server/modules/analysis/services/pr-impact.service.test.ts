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
  mapChangedFilesToImpactNodes: vi.fn(() => []),
  parseChangedFilesSnapshot: vi.fn(() => []),
  parsePersistedFindings: vi.fn(() => []),
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
    baseSha: "base",
    changedFilesJson: [],
    comments: [],
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
