import type { DbClient } from "@/server/core/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;
// Caps one run so a workspace with a huge backlog cannot hold the schedule for hours; the rest is
// picked up by the next run.
const MAX_BATCHES = 200;

export type HistoryRetentionSummary = {
  analyses: number;
  pullRequestAnalyses: number;
  workspaces: number;
};

type IdRow = { id: string };

async function drainBatches(
  fetchBatch: (take: number) => Promise<IdRow[]>,
  deleteBatch: (ids: string[]) => Promise<{ count: number }>,
): Promise<number> {
  let deleted = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const rows = await fetchBatch(BATCH_SIZE);

    if (rows.length === 0) {
      return deleted;
    }

    const result = await deleteBatch(rows.map((row) => row.id));
    deleted += result.count;

    if (rows.length < BATCH_SIZE) {
      return deleted;
    }
  }

  return deleted;
}

// Enforces the `historyDays` plan limit: `null` means unlimited, and documents/comments disappear
// with their analysis through the existing cascades.
export async function purgeExpiredHistory(
  db: DbClient,
  now: Date = new Date(),
): Promise<HistoryRetentionSummary> {
  const entitlements = await db.workspaceEntitlement.findMany({
    select: { historyDays: true, workspaceId: true },
    where: { historyDays: { not: null } },
  });

  let analyses = 0;
  let pullRequestAnalyses = 0;
  let workspaces = 0;

  for (const { historyDays, workspaceId } of entitlements) {
    // A non-positive limit would read as "delete everything", which no plan ever means.
    if (historyDays == null || historyDays <= 0) {
      continue;
    }

    workspaces += 1;
    const cutoff = new Date(now.getTime() - historyDays * DAY_MS);

    analyses += await drainBatches(
      (take) =>
        db.analysis.findMany({
          select: { id: true },
          take,
          where: { createdAt: { lt: cutoff }, repo: { workspaceId } },
        }),
      (ids) => db.analysis.deleteMany({ where: { id: { in: ids } } }),
    );

    pullRequestAnalyses += await drainBatches(
      (take) =>
        db.pullRequestAnalysis.findMany({
          select: { id: true },
          take,
          where: { createdAt: { lt: cutoff }, repo: { workspaceId } },
        }),
      (ids) => db.pullRequestAnalysis.deleteMany({ where: { id: { in: ids } } }),
    );
  }

  return { analyses, pullRequestAnalyses, workspaces };
}
