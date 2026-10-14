import { MAX_PAGE } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/core/db";
import {
  buildDateRangeWhere,
  cappedCount,
  getPaginatedList,
  ORDER_CREATED_AT_DESC,
} from "@/server/utils/pagination";
import { normalizeSearchInput } from "@/server/utils/search";

import type { AdminReviewFilterInput } from "./admin-review.schemas";

const REVIEW_SELECT = {
  _count: { select: { generatedFixes: true } },
  baseSha: true,
  createdAt: true,
  error: true,
  headSha: true,
  id: true,
  owner: true,
  prNumber: true,
  repoName: true,
  riskScore: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.PullRequestAnalysisSelect;

const FIX_SELECT = {
  branch: true,
  createdAt: true,
  estimatedImpact: true,
  githubPrNumber: true,
  githubPrUrl: true,
  id: true,
  status: true,
  title: true,
} satisfies Prisma.GeneratedFixSelect;

type ReviewRow = Prisma.PullRequestAnalysisGetPayload<{ select: typeof REVIEW_SELECT }>;

function toSummary(row: ReviewRow) {
  return {
    createdAt: row.createdAt,
    fixCount: row._count.generatedFixes,
    id: row.id,
    owner: row.owner,
    prNumber: row.prNumber,
    repoName: row.repoName,
    riskScore: row.riskScore,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

export function buildWhereClause(
  filters: Partial<AdminReviewFilterInput>,
): Prisma.PullRequestAnalysisWhereInput {
  const term = normalizeSearchInput(filters.search);

  return {
    ...(filters.status != null ? { status: filters.status } : {}),
    ...buildDateRangeWhere(filters, "createdAt"),
    ...(filters.minRiskScore != null ? { riskScore: { gte: filters.minRiskScore } } : {}),
    ...(filters.fixStatus != null
      ? { generatedFixes: { some: { status: filters.fixStatus } } }
      : {}),
    ...(term != null
      ? {
          OR: [
            { owner: { contains: term, mode: "insensitive" } },
            { repoName: { contains: term, mode: "insensitive" } },
            { prNumber: Number.isNaN(Number(term)) ? -1 : Number(term) },
          ],
        }
      : {}),
  };
}

export const adminReviewService = {
  buildWhereClause,

  async getAll(db: DbClient, input: AdminReviewFilterInput) {
    const { limit } = input;
    const where = buildWhereClause(input);
    const isUnfiltered = Object.keys(where).length === 0;

    const cap = MAX_PAGE * limit;
    const countMatching = (filterWhere: Prisma.PullRequestAnalysisWhereInput) =>
      cappedCount(
        (take) =>
          db.pullRequestAnalysis.findMany({ select: { id: true }, take, where: filterWhere }),
        cap,
      );

    const { items, meta } = await getPaginatedList({
      countCap: cap,
      countFiltered: () => countMatching(where),
      countUnfiltered: isUnfiltered ? null : () => countMatching({}),
      fetchItems: ({ skip, take }) =>
        db.pullRequestAnalysis.findMany({
          orderBy: ORDER_CREATED_AT_DESC,
          select: REVIEW_SELECT,
          skip,
          take,
          where,
        }),
      input: { ...input, limit },
    });

    return { items: items.map(toSummary), meta };
  },

  async getDetail(db: DbClient, id: string) {
    const review = await db.pullRequestAnalysis.findUnique({
      select: {
        ...REVIEW_SELECT,
        generatedFixes: { orderBy: { createdAt: "desc" }, select: FIX_SELECT },
        repo: { select: { id: true } },
      },
      where: { id },
    });

    if (review == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
    }

    const { generatedFixes: fixes, repo, ...summary } = review;

    return {
      ...toSummary({ ...summary, _count: { generatedFixes: fixes.length } }),
      baseSha: review.baseSha,
      error: review.error,
      fixes,
      headSha: review.headSha,
      repoId: repo.id,
    };
  },
};
