import { MessageCode } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";

import { AppError } from "@/server/core/api-error";
import type { DbClient } from "@/server/core/db";
import {
  buildDateRangeWhere,
  keysetArgs,
  ORDER_CREATED_AT_DESC,
  splitKeysetPage,
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
    const { cursor, limit } = input;

    const rows = await db.pullRequestAnalysis.findMany({
      ...keysetArgs(cursor, limit),
      orderBy: ORDER_CREATED_AT_DESC,
      select: REVIEW_SELECT,
      where: buildWhereClause(input),
    });

    const { hasNextPage, items, nextCursor } = splitKeysetPage(rows, limit);

    return { items: items.map(toSummary), meta: { hasNextPage, nextCursor } };
  },

  async getDetail(db: DbClient, id: string) {
    const review = await db.pullRequestAnalysis.findUnique({
      select: {
        ...REVIEW_SELECT,
        repo: { select: { id: true } },
      },
      where: { id },
    });

    if (review == null) {
      throw new AppError({
        code: "NOT_FOUND",
        messageCode: MessageCode.REVIEW_NOT_FOUND,
        publicMessage: "Review not found",
      });
    }

    const { repo, ...summary } = review;

    return {
      ...toSummary(summary),
      baseSha: review.baseSha,
      error: review.error,
      headSha: review.headSha,
      repoId: repo.id,
    };
  },

  async listFixes(db: DbClient, id: string, input: { cursor?: null | string; limit: number }) {
    const rows = await db.generatedFix.findMany({
      ...keysetArgs(input.cursor, input.limit),
      orderBy: ORDER_CREATED_AT_DESC,
      select: FIX_SELECT,
      where: { prAnalysisId: id },
    });

    const { hasNextPage, items, nextCursor } = splitKeysetPage(rows, input.limit);

    return { items, meta: { hasNextPage, nextCursor } };
  },
};
