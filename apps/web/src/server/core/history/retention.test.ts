import { afterEach, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/server/core/db";

import { purgeExpiredHistory } from "./retention";

const WORKSPACE_ID = "0195a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a70";
const NOW = new Date("2026-11-03T12:00:00.000Z");

function createDbMock(options?: {
  analyses?: Array<Array<{ id: string }>>;
  entitlements?: Array<{ historyDays: null | number; workspaceId: string }>;
  pullRequestAnalyses?: Array<Array<{ id: string }>>;
}) {
  const analysisBatches = [...(options?.analyses ?? [[]])];
  const pullRequestBatches = [...(options?.pullRequestAnalyses ?? [[]])];

  const nextBatch = (batches: Array<Array<{ id: string }>>) => batches.shift() ?? [];

  const analysisFindMany = vi.fn(() => Promise.resolve(nextBatch(analysisBatches)));
  const analysisDeleteMany = vi.fn((args: { where: { id: { in: string[] } } }) =>
    Promise.resolve({ count: args.where.id.in.length }),
  );
  const prFindMany = vi.fn(() => Promise.resolve(nextBatch(pullRequestBatches)));
  const prDeleteMany = vi.fn((args: { where: { id: { in: string[] } } }) =>
    Promise.resolve({ count: args.where.id.in.length }),
  );
  const entitlementFindMany = vi.fn(() =>
    Promise.resolve(options?.entitlements ?? [{ historyDays: 7, workspaceId: WORKSPACE_ID }]),
  );

  const db = {
    analysis: { deleteMany: analysisDeleteMany, findMany: analysisFindMany },
    pullRequestAnalysis: { deleteMany: prDeleteMany, findMany: prFindMany },
    workspaceEntitlement: { findMany: entitlementFindMany },
  } as unknown as DbClient;

  return {
    analysisDeleteMany,
    analysisFindMany,
    db,
    entitlementFindMany,
    prDeleteMany,
    prFindMany,
  };
}

function ids(count: number, prefix = "id") {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));
}

describe("purgeExpiredHistory", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should only look at workspaces that have a finite history limit", async () => {
    const { db, entitlementFindMany } = createDbMock();

    await purgeExpiredHistory(db, NOW);

    expect(entitlementFindMany).toHaveBeenCalledWith({
      select: { historyDays: true, workspaceId: true },
      where: { historyDays: { not: null } },
    });
  });

  it("should do nothing when no workspace has a finite limit", async () => {
    const { analysisFindMany, db, prFindMany } = createDbMock({ entitlements: [] });

    await expect(purgeExpiredHistory(db, NOW)).resolves.toStrictEqual({
      analyses: 0,
      pullRequestAnalyses: 0,
      workspaces: 0,
    });
    expect(analysisFindMany).not.toHaveBeenCalled();
    expect(prFindMany).not.toHaveBeenCalled();
  });

  it("should ignore an unlimited entitlement even if it leaks through the filter", async () => {
    const { analysisFindMany, db } = createDbMock({
      entitlements: [{ historyDays: null, workspaceId: WORKSPACE_ID }],
    });

    const summary = await purgeExpiredHistory(db, NOW);

    expect(summary.workspaces).toBe(0);
    expect(analysisFindMany).not.toHaveBeenCalled();
  });

  it("should ignore a non-positive limit instead of wiping the workspace", async () => {
    const { analysisFindMany, db, prFindMany } = createDbMock({
      entitlements: [{ historyDays: 0, workspaceId: WORKSPACE_ID }],
    });

    const summary = await purgeExpiredHistory(db, NOW);

    expect(summary.workspaces).toBe(0);
    expect(analysisFindMany).not.toHaveBeenCalled();
    expect(prFindMany).not.toHaveBeenCalled();
  });

  it("should cut off exactly at the plan limit inside the workspace", async () => {
    const { analysisFindMany, db } = createDbMock();

    await purgeExpiredHistory(db, NOW);

    expect(analysisFindMany).toHaveBeenCalledWith({
      select: { id: true },
      take: 500,
      where: {
        createdAt: { lt: new Date("2026-10-27T12:00:00.000Z") },
        repo: { workspaceId: WORKSPACE_ID },
      },
    });
  });

  it("should delete every full batch and stop after the partial one", async () => {
    const { analysisDeleteMany, analysisFindMany, db } = createDbMock({
      analyses: [ids(500), ids(3, "tail")],
    });

    const summary = await purgeExpiredHistory(db, NOW);

    expect(analysisFindMany).toHaveBeenCalledTimes(2);
    expect(analysisDeleteMany).toHaveBeenCalledTimes(2);
    expect(summary.analyses).toBe(503);
  });

  it("should stop after a short first batch without a second query", async () => {
    const { analysisDeleteMany, analysisFindMany, db } = createDbMock({
      analyses: [ids(4)],
    });

    await purgeExpiredHistory(db, NOW);

    expect(analysisFindMany).toHaveBeenCalledOnce();
    expect(analysisDeleteMany).toHaveBeenCalledOnce();
  });

  it("should clean pull request analyses under the same cutoff", async () => {
    const { db, prDeleteMany, prFindMany } = createDbMock({
      pullRequestAnalyses: [ids(2, "pr")],
    });

    const summary = await purgeExpiredHistory(db, NOW);

    expect(prFindMany).toHaveBeenCalledWith({
      select: { id: true },
      take: 500,
      where: {
        createdAt: { lt: new Date("2026-10-27T12:00:00.000Z") },
        repo: { workspaceId: WORKSPACE_ID },
      },
    });
    expect(prDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["pr-0", "pr-1"] } } });
    expect(summary.pullRequestAnalyses).toBe(2);
  });

  it("should cap a runaway backlog so the scheduled run always finishes", async () => {
    const endless = Array.from({ length: 1000 }, () => ids(500));
    const { analysisFindMany, db } = createDbMock({ analyses: endless });

    const summary = await purgeExpiredHistory(db, NOW);

    expect(analysisFindMany).toHaveBeenCalledTimes(200);
    expect(summary.analyses).toBe(100_000);
  });

  it("should process every workspace with a finite limit", async () => {
    const { db, entitlementFindMany } = createDbMock({
      analyses: [ids(1, "a"), ids(1, "b")],
      entitlements: [
        { historyDays: 7, workspaceId: "ws-hobby" },
        { historyDays: 90, workspaceId: "ws-pro" },
      ],
    });

    const summary = await purgeExpiredHistory(db, NOW);

    expect(entitlementFindMany).toHaveBeenCalledOnce();
    expect(summary.workspaces).toBe(2);
    expect(summary.analyses).toBe(2);
  });
});
