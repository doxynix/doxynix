import { MessageCode } from "@doxynix/shared";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { analysisRepo, loadDocumentsPerType } from "./analysis.repository";

const ANALYSIS_ID = "0195f000-0000-7000-8000-000000000001";
const REPO_ID = "0195f000-0000-7000-8000-000000000002";
const WORKSPACE_ID = "0195f000-0000-7000-8000-000000000003";

const ANALYSIS = {
  commitSha: "abc123",
  complexityScore: 10,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  id: ANALYSIS_ID,
  metricsJson: { healthScore: 80 },
  onboardingScore: 70,
  resultJson: { facts: [] },
  score: 80,
  securityScore: 90,
  status: "DONE" as const,
  techDebtScore: 20,
};

type NestedArgs = {
  orderBy?: unknown;
  select?: Record<string, unknown>;
  take?: number;
  where?: Record<string, unknown>;
};

type Call = { orderBy?: unknown; select?: Record<string, NestedArgs>; where?: unknown };

// Captures every call so a test can prove the method issued one query, not two.
function makeDb(result: unknown) {
  const calls: Call[] = [];
  const findUnique = async (args: Call) => {
    calls.push(args);
    return result;
  };

  return { calls, db: { repo: { findUnique } } as unknown as DbClient };
}

function nested(call: Call | undefined, relation: "analyses"): NestedArgs {
  return call?.select?.[relation] ?? {};
}

describe("analysisRepo.getRepoSnapshot", () => {
  it("resolves the requested analysis inside the one repo query", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS], id: REPO_ID });

    const repo = await analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID);

    expect(repo?.analyses[0]?.id).toBe(ANALYSIS_ID);
    expect(calls).toHaveLength(1);
    expect(nested(calls[0], "analyses")).toMatchObject({
      take: 1,
      where: { id: ANALYSIS_ID, status: "DONE" },
    });
  });

  it("asks for the latest completed analysis when no version is pinned", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS], id: REPO_ID });

    await analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID);

    expect(calls).toHaveLength(1);
    expect(nested(calls[0], "analyses").where).toStrictEqual({ status: "DONE" });
  });

  it("returns null when the repo is missing", async () => {
    const { db } = makeDb(null);

    await expect(
      analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).resolves.toBeNull();
  });

  it("throws ANALYSIS_VERSION_NOT_FOUND for an aid outside this repo's completed analyses", async () => {
    const { db } = makeDb({ analyses: [], id: REPO_ID });

    await expect(
      analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND,
      publicMessage: "Analysis version not found",
    });
  });

  it("throws ANALYSIS_NOT_COMPLETED when the repo has no completed analysis", async () => {
    const { db } = makeDb({ analyses: [], id: REPO_ID });

    await expect(analysisRepo.getRepoSnapshot(db, REPO_ID, WORKSPACE_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
      messageCode: MessageCode.ANALYSIS_NOT_COMPLETED,
      publicMessage: "No completed analysis found",
    });
  });
});

describe("loadDocumentsPerType", () => {
  type Query = { sql: string; values: readonly unknown[] };

  function makeDocDb(rows: unknown[] = [], contents: unknown[] = []) {
    const queries: Query[] = [];
    const findMany = vi.fn(async () => contents);
    const db = {
      $queryRawTyped: async (query: Query) => {
        queries.push(query);
        return rows;
      },
      document: { findMany },
    } as unknown as DbClient;

    return { db, findMany, queries };
  }

  const ROW = {
    analysisId: ANALYSIS_ID,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "0195f000-0000-7000-8000-000000000009",
    path: null,
    type: "README" as const,
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    version: "abc123",
  };

  const DOCUMENT = {
    analysis: { id: ANALYSIS_ID },
    createdAt: ROW.createdAt,
    id: ROW.id,
    path: ROW.path,
    type: ROW.type,
    updatedAt: ROW.updatedAt,
    version: ROW.version,
  };

  it("windows the rows per document kind instead of capping the whole repo", async () => {
    const { db, queries } = makeDocDb([ROW]);

    await loadDocumentsPerType(db, REPO_ID, WORKSPACE_ID, { perType: 1 });

    expect(queries).toHaveLength(1);
    expect(queries[0]?.values).toStrictEqual([REPO_ID, WORKSPACE_ID, null, 1]);
    expect(queries[0]?.sql).toContain("ROW_NUMBER() OVER");
  });

  it("scopes the window to the pinned analysis only when one is requested", async () => {
    const { db, queries } = makeDocDb();

    await loadDocumentsPerType(db, REPO_ID, WORKSPACE_ID, { aid: ANALYSIS_ID, perType: 3 });

    expect(queries[0]?.values).toStrictEqual([REPO_ID, WORKSPACE_ID, ANALYSIS_ID, 3]);
  });

  it("maps the SQL row onto the document shape the mappers read", async () => {
    const { db } = makeDocDb([ROW]);

    await expect(
      loadDocumentsPerType(db, REPO_ID, WORKSPACE_ID, { perType: 1 }),
    ).resolves.toStrictEqual([DOCUMENT]);
  });

  it("reads content through Prisma only when it is asked for", async () => {
    const metadataOnly = makeDocDb([ROW]);

    await loadDocumentsPerType(metadataOnly.db, REPO_ID, WORKSPACE_ID, { perType: 1 });

    expect(metadataOnly.findMany).not.toHaveBeenCalled();

    const withContent = makeDocDb([ROW], [{ content: "# readme", id: ROW.id }]);

    await expect(
      loadDocumentsPerType(withContent.db, REPO_ID, WORKSPACE_ID, {
        perType: 1,
        withContent: true,
      }),
    ).resolves.toStrictEqual([{ ...DOCUMENT, content: "# readme" }]);
    expect(withContent.findMany).toHaveBeenCalledWith({
      select: { content: true, id: true },
      where: {
        id: { in: [ROW.id] },
        repo: { id: REPO_ID, workspaceId: WORKSPACE_ID },
      },
    });
  });

  it("issues no content read for a repo without documents", async () => {
    const { db, findMany } = makeDocDb();

    await expect(
      loadDocumentsPerType(db, REPO_ID, WORKSPACE_ID, { perType: 1, withContent: true }),
    ).resolves.toStrictEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("analysisRepo.getRepoBySha", () => {
  it("carries no documents, because no caller of the PR detail reads them", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS], id: REPO_ID });

    await analysisRepo.getRepoBySha(db, REPO_ID, "abc123", WORKSPACE_ID);

    expect(Object.keys(calls[0]?.select ?? {})).not.toContain("documents");
    expect(nested(calls[0], "analyses").where).toStrictEqual({
      commitSha: "abc123",
      status: "DONE",
    });
  });
});

describe("analysisRepo.getRepoForImpact", () => {
  function makeImpactDb(repo: unknown, pinned: unknown = null) {
    const analysisCalls: Call[] = [];
    const repoCalls: Call[] = [];
    const db = {
      analysis: {
        findFirst: async (args: Call) => {
          analysisCalls.push(args);
          return pinned;
        },
      },
      repo: {
        findUnique: async (args: Call) => {
          repoCalls.push(args);
          return repo;
        },
      },
    } as unknown as DbClient;

    return { analysisCalls, db, repoCalls };
  }

  const NEWEST = {
    ...ANALYSIS,
    commitSha: "newest",
    id: "0195f000-0000-7000-8000-00000000000b",
  };
  const HISTORIC = {
    ...ANALYSIS,
    commitSha: "head-sha",
    id: "0195f000-0000-7000-8000-00000000000c",
  };

  it("still finds a head sha that is older than the two newest completed analyses", async () => {
    // A and B are the two newest DONE analyses; `take: 1` hides B from the heavy read and C is three
    // analyses back, so only the narrow lookup can return it — a force-pushed PR must not lose it.
    const { analysisCalls, db, repoCalls } = makeImpactDb(
      { analyses: [NEWEST], id: REPO_ID },
      HISTORIC,
    );

    const repo = await analysisRepo.getRepoForImpact(db, REPO_ID, WORKSPACE_ID, "head-sha");

    expect(repoCalls).toHaveLength(1);
    expect(nested(repoCalls[0], "analyses").take).toBe(1);
    expect(nested(repoCalls[0], "analyses").where).toStrictEqual({ status: "DONE" });
    expect(analysisCalls).toHaveLength(1);
    expect(analysisCalls[0]?.where).toStrictEqual({
      commitSha: "head-sha",
      repo: { id: REPO_ID, workspaceId: WORKSPACE_ID },
      status: "DONE",
    });
    // Re-runs of one commit keep the newest row, like the old `getRepoBySha` did.
    expect(analysisCalls[0]?.orderBy).toStrictEqual({ createdAt: "desc" });
    // The same payload the page reads, so the pinned row is a drop-in for the latest one.
    expect(Object.keys(analysisCalls[0]?.select ?? {})).toStrictEqual(
      expect.arrayContaining(["commitSha", "metricsJson", "resultJson"]),
    );
    expect(repo?.analyses.map((analysis) => analysis.id)).toStrictEqual([HISTORIC.id]);
  });

  it("skips the narrow lookup when the newest analysis is already the head sha", async () => {
    const { analysisCalls, db } = makeImpactDb({ analyses: [NEWEST], id: REPO_ID });

    const repo = await analysisRepo.getRepoForImpact(db, REPO_ID, WORKSPACE_ID, "newest");

    expect(analysisCalls).toHaveLength(0);
    expect(repo?.analyses.map((analysis) => analysis.id)).toStrictEqual([NEWEST.id]);
  });

  it("falls back to the newest completed analysis when no analysis matches the head sha", async () => {
    const { db } = makeImpactDb({ analyses: [NEWEST], id: REPO_ID }, null);

    const repo = await analysisRepo.getRepoForImpact(db, REPO_ID, WORKSPACE_ID, "head-sha");

    expect(repo?.analyses.map((analysis) => analysis.id)).toStrictEqual([NEWEST.id]);
  });

  it("returns null for a repo outside the workspace and throws when nothing has completed", async () => {
    await expect(
      analysisRepo.getRepoForImpact(makeImpactDb(null).db, REPO_ID, WORKSPACE_ID, "head-sha"),
    ).resolves.toBeNull();

    await expect(
      analysisRepo.getRepoForImpact(
        makeImpactDb({ analyses: [] }).db,
        REPO_ID,
        WORKSPACE_ID,
        "head-sha",
      ),
    ).rejects.toMatchObject({ messageCode: MessageCode.ANALYSIS_NOT_COMPLETED });
  });
});

describe("analysisRepo.getRepoDocsPayload", () => {
  type Query = { sql: string; values: readonly unknown[] };
  function makeDocsDb(repo: unknown, target: unknown = null) {
    const queries: Query[] = [];
    const db = {
      $queryRawTyped: async (query: Query) => {
        queries.push(query);
        return [];
      },
      analysis: { findFirst: async () => target },
      repo: { findUnique: async () => repo },
    } as unknown as DbClient;

    return { db, queries };
  }

  it("reads one row per document kind instead of every version of the repo", async () => {
    const { db, queries } = makeDocsDb({ analyses: [ANALYSIS] });

    const payload = await analysisRepo.getRepoDocsPayload(db, REPO_ID, WORKSPACE_ID);

    expect(payload?.documents).toStrictEqual([]);
    expect(queries[0]?.values).toStrictEqual([REPO_ID, WORKSPACE_ID, null, 1]);
  });

  it("pins both the analysis and its documents to the requested version", async () => {
    const { db, queries } = makeDocsDb({ analyses: [ANALYSIS] }, ANALYSIS);

    const payload = await analysisRepo.getRepoDocsPayload(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID);

    expect(payload?.analyses[0]?.id).toBe(ANALYSIS_ID);
    expect(queries[0]?.values[2]).toBe(ANALYSIS_ID);
  });

  it("returns null when the repo is missing", async () => {
    const { db } = makeDocsDb(null);

    await expect(
      analysisRepo.getRepoDocsPayload(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).resolves.toBeNull();
  });

  it("still throws ANALYSIS_VERSION_NOT_FOUND for an aid outside the workspace", async () => {
    const { db, queries } = makeDocsDb({ analyses: [ANALYSIS] }, null);

    await expect(
      analysisRepo.getRepoDocsPayload(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).rejects.toMatchObject({ messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND });
    expect(queries).toHaveLength(0);
  });

  it("throws ANALYSIS_NOT_COMPLETED without reading documents", async () => {
    const { db, queries } = makeDocsDb({ analyses: [] });

    await expect(analysisRepo.getRepoDocsPayload(db, REPO_ID, WORKSPACE_ID)).rejects.toMatchObject({
      messageCode: MessageCode.ANALYSIS_NOT_COMPLETED,
    });
    expect(queries).toHaveLength(0);
  });
});

describe("analysisRepo.getAnalysisPayloadForRepo", () => {
  it("returns the requested payload from a single query", async () => {
    const { calls, db } = makeDb({ analyses: [ANALYSIS] });

    const analysis = await analysisRepo.getAnalysisPayloadForRepo(
      db,
      REPO_ID,
      WORKSPACE_ID,
      ANALYSIS_ID,
    );

    expect(analysis?.id).toBe(ANALYSIS_ID);
    expect(calls).toHaveLength(1);
    expect(nested(calls[0], "analyses").where).toStrictEqual({
      id: ANALYSIS_ID,
      status: "DONE",
    });
  });

  it("returns null when the repo is missing", async () => {
    const { db } = makeDb(null);

    await expect(
      analysisRepo.getAnalysisPayloadForRepo(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).resolves.toBeNull();
  });

  it("throws ANALYSIS_VERSION_NOT_FOUND for an unknown aid", async () => {
    const { db } = makeDb({ analyses: [] });

    await expect(
      analysisRepo.getAnalysisPayloadForRepo(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).rejects.toMatchObject({
      messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND,
      publicMessage: "Analysis version not found",
    });
  });
});

describe("analysisRepo.getByRepoId", () => {
  it("reads one keyset page newest-first with the id tiebreak", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { generatedFix: { findMany } } as unknown as DbClient;

    await analysisRepo.getByRepoId(db, REPO_ID, WORKSPACE_ID, { limit: 50 });

    expect(findMany).toHaveBeenCalledWith({
      cursor: undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
      where: { repo: { id: REPO_ID, workspaceId: WORKSPACE_ID } },
    });
  });

  it("resumes after the cursor instead of re-reading the first page", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { generatedFix: { findMany } } as unknown as DbClient;

    await analysisRepo.getByRepoId(db, REPO_ID, WORKSPACE_ID, {
      cursor: "0195f000-0000-7000-8000-000000000009",
      limit: 20,
    });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      cursor: { id: "0195f000-0000-7000-8000-000000000009" },
      take: 21,
    });
  });
});

describe("analysisRepo.loadImpactAnalysis", () => {
  function makePullDb() {
    const findFirst = vi.fn().mockResolvedValue(null);

    return { db: { pullRequestAnalysis: { findFirst } } as unknown as DbClient, findFirst };
  }

  function selectOf(findFirst: ReturnType<typeof vi.fn>) {
    return findFirst.mock.calls[0]?.[0]?.select as Record<string, unknown>;
  }

  it("drops the unused comments relation and keeps every other column", async () => {
    const { db, findFirst } = makePullDb();

    await analysisRepo.loadImpactAnalysis(db, REPO_ID, 7, WORKSPACE_ID);

    expect(Object.keys(selectOf(findFirst)).sort()).toStrictEqual([
      "_count",
      "baseSha",
      "changedFilesJson",
      "createdAt",
      "findingsJson",
      "headSha",
      "id",
      "prNumber",
      "riskScore",
      "status",
      "updatedAt",
    ]);
  });

  it("asks for the counted fixes without loading the rows", async () => {
    const { db, findFirst } = makePullDb();

    await analysisRepo.loadImpactAnalysis(db, REPO_ID, 7, WORKSPACE_ID);

    const select = selectOf(findFirst);
    expect(select).not.toHaveProperty("generatedFixes");
    expect(select._count).toStrictEqual({ select: { generatedFixes: true } });
  });
});

describe("analysisRepo.getByPrAnalysisId", () => {
  function makeFixDb(rows: unknown[] = []) {
    const findMany = vi.fn().mockResolvedValue(rows);
    const db = { generatedFix: { findMany } } as unknown as DbClient;

    return { db, findMany };
  }

  it("keysets the fixes of one analysis inside the workspace, newest first", async () => {
    const { db, findMany } = makeFixDb();

    await analysisRepo.getByPrAnalysisId(db, ANALYSIS_ID, WORKSPACE_ID, {
      cursor: null,
      limit: 20,
    });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      cursor: undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
      where: { prAnalysisId: ANALYSIS_ID, repo: { workspaceId: WORKSPACE_ID } },
    });
  });
});

describe("analysisRepo.getRepoRef", () => {
  it("selects only the columns and ids the docs viewer reads", async () => {
    const { calls, db } = makeDb({ analyses: [{ id: ANALYSIS_ID }], id: REPO_ID });

    const ref = await analysisRepo.getRepoRef(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID);

    expect(ref?.analyses[0]?.id).toBe(ANALYSIS_ID);
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0]?.select ?? {}).sort()).toStrictEqual([
      "analyses",
      "defaultBranch",
      "id",
      "name",
      "owner",
      "url",
    ]);
    expect(nested(calls[0], "analyses").select).toStrictEqual({ id: true });
  });

  it("throws ANALYSIS_NOT_COMPLETED when the repo has no completed analysis", async () => {
    const { db } = makeDb({ analyses: [], id: REPO_ID });

    await expect(analysisRepo.getRepoRef(db, REPO_ID, WORKSPACE_ID)).rejects.toMatchObject({
      messageCode: MessageCode.ANALYSIS_NOT_COMPLETED,
      publicMessage: "No completed analysis found",
    });
  });

  it("throws ANALYSIS_VERSION_NOT_FOUND when the pinned analysis is missing", async () => {
    const { db } = makeDb({ analyses: [], id: REPO_ID });

    await expect(
      analysisRepo.getRepoRef(db, REPO_ID, WORKSPACE_ID, ANALYSIS_ID),
    ).rejects.toMatchObject({
      messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND,
      publicMessage: "Analysis version not found",
    });
  });
});
