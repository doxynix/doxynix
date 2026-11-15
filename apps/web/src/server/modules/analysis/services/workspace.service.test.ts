import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

const mocks = vi.hoisted(() => ({
  getNodeExplain: vi.fn(),
  getRepoSnapshot: vi.fn(),
  getStructureMap: vi.fn(),
  getStructureNode: vi.fn(),
  loadLatestDocumentsWithContent: vi.fn(),
  loadRelatedFixes: vi.fn(),
  loadRelatedPrFindings: vi.fn(),
}));

vi.mock("../analysis.repository", () => ({
  analysisRepo: {
    getRepoSnapshot: mocks.getRepoSnapshot,
    loadLatestDocumentsWithContent: mocks.loadLatestDocumentsWithContent,
    loadRelatedFixes: mocks.loadRelatedFixes,
    loadRelatedPrFindings: mocks.loadRelatedPrFindings,
  },
}));

vi.mock("../logic/analyze-context-builder", () => ({
  createAnalyzeContextBuilder: () => ({
    getNodeExplain: mocks.getNodeExplain,
    getStructureMap: mocks.getStructureMap,
    getStructureNode: mocks.getStructureNode,
  }),
}));

vi.mock("../logic/brief", () => ({
  buildInteractiveBriefNodePayload: () => ({ title: "app.ts" }),
}));

import { workspaceService } from "./workspace.service";

const ANALYSIS_ID = "0195f000-0000-7000-8000-000000000001";
const REPO_ID = "0195f000-0000-7000-8000-000000000002";
const WORKSPACE_ID = "0195f000-0000-7000-8000-000000000003";

const NODE_ID = "file:src/app.ts";

const STRUCTURE_NODE = {
  breadcrumbs: [{ id: NODE_ID, label: "app.ts", path: "src/app.ts" }],
  canDrillDeeper: false,
  children: [],
  edges: [],
  inspect: { samplePaths: ["src/app.ts"] },
  node: { label: "app.ts", path: "src/app.ts", previewPaths: [] },
};

const EXPLAIN = {
  confidence: "high" as const,
  nextSuggestedPaths: [],
  relationships: {
    neighborBuckets: { graphNeighbors: [] },
    neighborPaths: [],
    recommendedActions: [],
    reviewPriority: null,
  },
  role: "service",
  sourcePaths: ["src/app.ts"],
  summary: ["Boots the app"],
  whyImportant: "Entrypoint",
};

function makeDb() {
  return {} as unknown as DbClient;
}

describe("workspaceService.getNodeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRepoSnapshot.mockResolvedValue({});
    mocks.getStructureMap.mockReturnValue(null);
    mocks.getStructureNode.mockReturnValue(STRUCTURE_NODE);
    mocks.getNodeExplain.mockReturnValue(EXPLAIN);
    mocks.loadLatestDocumentsWithContent.mockResolvedValue([]);
    mocks.loadRelatedFixes.mockResolvedValue([]);
    mocks.loadRelatedPrFindings.mockResolvedValue([]);
  });

  it("pins the related documents to the analysis the page is showing", async () => {
    const db = makeDb();

    await workspaceService.getNodeContext(db, REPO_ID, NODE_ID, WORKSPACE_ID, ANALYSIS_ID);

    expect(mocks.loadLatestDocumentsWithContent).toHaveBeenCalledWith(
      db,
      REPO_ID,
      WORKSPACE_ID,
      ANALYSIS_ID,
    );
  });

  it("leaves the version unset when the view is not pinned", async () => {
    const db = makeDb();

    await workspaceService.getNodeContext(db, REPO_ID, NODE_ID, WORKSPACE_ID);

    expect(mocks.loadLatestDocumentsWithContent).toHaveBeenCalledWith(
      db,
      REPO_ID,
      WORKSPACE_ID,
      undefined,
    );
  });
});
