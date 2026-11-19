import { type DocType, type FixStatus, MessageCode, PRAnalysisStatus } from "@doxynix/shared";
import type { Prisma } from "@prisma/client";
import { getLatestDocumentsPerType } from "@prisma/client/sql";
import { uniq } from "es-toolkit";
import type { z } from "zod";

import { AppError } from "@/server/core/api-error";
import type { DbClient } from "@/server/core/db";
import { keysetArgs, ORDER_CREATED_AT_DESC } from "@/server/utils/pagination";

import type { persistedFindingSchema } from "./analysis.schemas";
import { fixesMapper } from "./fixes.mapper";
import type { PRChangedFileSnapshot } from "./logic/pr.types";

type PRAnalysisCreateInput = {
  baseSha: string;
  headSha: string;
  owner: string;
  prNumber: number;
  repoId: string;
  repoName: string;
};

export const latestCompletedAnalysisSelect = {
  commitSha: true,
  complexityScore: true,
  createdAt: true,
  id: true,
  metricsJson: true,
  onboardingScore: true,
  resultJson: true,
  score: true,
  securityScore: true,
  status: true,
  techDebtScore: true,
} satisfies Prisma.AnalysisSelect;

export type LatestCompletedAnalysis = Prisma.AnalysisGetPayload<{
  select: typeof latestCompletedAnalysisSelect;
}>;

export const analysisPayloadSelect = {
  id: true,
  metricsJson: true,
  resultJson: true,
} satisfies Prisma.AnalysisSelect;

export type AnalysisPayloadRecord = Prisma.AnalysisGetPayload<{
  select: typeof analysisPayloadSelect;
}>;

// The requested analysis and the latest completed one are the same query, filtered by `aid`.
function targetAnalysisArgs<const S extends Prisma.AnalysisSelect>(
  aid: string | undefined,
  select: S,
) {
  return {
    orderBy: { createdAt: "desc" as const },
    select,
    take: 1,
    where: aid == null ? { status: "DONE" as const } : { id: aid, status: "DONE" as const },
  };
}

function missingAnalysisError(aid: string | undefined) {
  return new AppError(
    aid == null
      ? {
          code: "NOT_FOUND",
          messageCode: MessageCode.ANALYSIS_NOT_COMPLETED,
          publicMessage: "No completed analysis found",
        }
      : {
          code: "NOT_FOUND",
          messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND,
          publicMessage: "Analysis version not found",
        },
  );
}

export const repoWithLatestAnalysisSelect = {
  analyses: {
    orderBy: { createdAt: "desc" },
    select: latestCompletedAnalysisSelect,
    take: 1,
    where: { status: "DONE" },
  },
  defaultBranch: true,
  description: true,
  forks: true,
  id: true,
  language: true,
  license: true,
  name: true,
  openIssues: true,
  owner: true,
  ownerAvatarUrl: true,
  pushedAt: true,
  size: true,
  stars: true,
  topics: true,
  url: true,
  visibility: true,
} satisfies Prisma.RepoSelect;

export type RepoSnapshot = Prisma.RepoGetPayload<{
  select: typeof repoWithLatestAnalysisSelect;
}>;

export type RepoDocument = {
  analysis: { id: string } | null;
  createdAt: Date;
  id: string;
  path: null | string;
  type: DocType;
  updatedAt: Date;
  version: string;
};

export type RepoDocumentWithContent = RepoDocument & { content: string };

type RepoDocuments<W extends boolean> = Array<
  W extends true ? RepoDocumentWithContent : RepoDocument
>;

// The workspace view composes documents onto the snapshot instead of carrying them in the select,
// so they are bounded per document type.
export type RepoWithLatestAnalysisAndDocs = RepoSnapshot & { documents: RepoDocument[] };

// Raw SQL does not pass through `fieldEncryptionExtension`, so content is read separately through
// Prisma: `Document.content` is encrypted at rest and this query only picks which rows to read.
export async function loadDocumentsPerType<W extends boolean = false>(
  db: DbClient,
  repoId: string,
  workspaceId: string,
  options: { aid?: string; perType: number; withContent?: W },
): Promise<RepoDocuments<W>> {
  const rows = await db.$queryRawTyped(
    getLatestDocumentsPerType(repoId, workspaceId, options.aid ?? null, options.perType),
  );

  const documents = rows.map(
    (row): RepoDocument => ({
      analysis: row.analysisId == null ? null : { id: row.analysisId },
      createdAt: row.createdAt,
      id: row.id,
      path: row.path,
      type: row.type,
      updatedAt: row.updatedAt,
      version: row.version,
    }),
  );

  if (options.withContent !== true || documents.length === 0) {
    return documents as RepoDocuments<W>;
  }

  const contents = await db.document.findMany({
    select: { content: true, id: true },
    where: {
      id: { in: documents.map((document) => document.id) },
      repo: { id: repoId, workspaceId },
    },
  });
  const contentById = new Map(contents.map((row) => [row.id, row.content]));

  const withContent = documents.flatMap((document) => {
    const content = contentById.get(document.id);
    return content == null ? [] : [{ ...document, content }];
  });

  return withContent;
}

export type AnalysisRef = {
  analysisId: string;
  commitSha: null | string;
  createdAt: Date;
};

export type ImpactAnalysisRecord = Awaited<ReturnType<typeof analysisRepo.loadImpactAnalysis>>;
export type ImpactAnalysis = NonNullable<ImpactAnalysisRecord>;

export const analysisRepo = {
  // No revalidateTag: a task has no Next store; readers miss the old page via the analysis version.
  async addComments(
    db: DbClient,
    analysisId: string,
    comments: Array<{
      body: string;
      filePath: string;
      findingType: string;
      line: number;
      riskLevel: number;
    }>,
  ) {
    return db.pullRequestComment.createMany({
      data: comments.map((c) => ({
        analysisId,
        body: c.body,
        filePath: c.filePath,
        findingType: c.findingType,
        line: c.line,
        riskLevel: c.riskLevel,
      })),
    });
  },

  async create(
    db: DbClient,
    input: {
      branch: string;
      createdByUser?: boolean;
      description?: string;
      prAnalysisId?: string;
      repoId: string;
      title: string;
    },
  ) {
    return db.generatedFix.create({
      data: {
        branch: input.branch,
        createdByUser: input.createdByUser ?? false,
        description: input.description,
        repo: { connect: { id: input.repoId } },
        status: "DRAFT",
        title: input.title,
        ...(input.prAnalysisId != null && {
          prAnalysis: { connect: { id: input.prAnalysisId } },
        }),
      },
    });
  },

  async createPRAnalysis(db: DbClient, input: PRAnalysisCreateInput) {
    return db.pullRequestAnalysis.create({
      data: {
        baseSha: input.baseSha,
        headSha: input.headSha,
        owner: input.owner,
        prNumber: input.prNumber,
        repo: {
          connect: {
            id: input.repoId,
          },
        },
        repoName: input.repoName,
        status: PRAnalysisStatus.PENDING,
      },
    });
  },

  async getAnalysisPayloadForRepo(
    db: DbClient,
    repoId: string,
    workspaceId: string,
    aid?: string,
  ): Promise<AnalysisPayloadRecord | null> {
    const repo = await db.repo.findUnique({
      select: {
        analyses: targetAnalysisArgs(aid, analysisPayloadSelect),
      },
      where: { id: repoId, workspaceId },
    });

    if (repo == null) {
      return null;
    }

    const analysis = repo.analyses[0];

    if (analysis == null) {
      throw missingAnalysisError(aid);
    }

    return analysis;
  },

  async getById(db: DbClient, id: string, workspaceId: string) {
    return db.generatedFix.findFirst({
      where: { id, repo: { workspaceId } },
    });
  },

  async getByPrAnalysisId(
    db: DbClient,
    prAnalysisId: string,
    workspaceId: string,
    input: { cursor?: null | string; limit: number },
  ) {
    return db.generatedFix.findMany({
      ...keysetArgs(input.cursor, input.limit),
      orderBy: ORDER_CREATED_AT_DESC,
      select: {
        githubPrNumber: true,
        githubPrUrl: true,
        id: true,
        status: true,
        title: true,
      },
      where: { prAnalysisId, repo: { workspaceId } },
    });
  },

  async getByRepoAndPRNumber(db: DbClient, repoId: string, prNumber: number, workspaceId: string) {
    return db.pullRequestAnalysis.findFirst({
      orderBy: {
        createdAt: "desc",
      },
      select: { id: true },
      where: {
        prNumber,
        repo: {
          id: repoId,
          workspaceId,
        },
      },
    });
  },

  async getByRepoId(
    db: DbClient,
    repoId: string,
    workspaceId: string,
    input: { cursor?: null | string; limit: number },
  ) {
    return db.generatedFix.findMany({
      ...keysetArgs(input.cursor, input.limit),
      orderBy: ORDER_CREATED_AT_DESC,
      where: { repo: { id: repoId, workspaceId } },
    });
  },

  async getLatestRef(
    db: DbClient,
    repoId: string,
    workspaceId: string,
  ): Promise<AnalysisRef | null> {
    const analysis = await db.analysis.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        commitSha: true,
        createdAt: true,
        id: true,
      },
      where: { repo: { id: repoId, workspaceId }, status: "DONE" },
    });

    if (analysis == null) {
      return null;
    }

    return {
      analysisId: analysis.id,
      commitSha: analysis.commitSha,
      createdAt: analysis.createdAt,
    };
  },

  async getRepoBySha(
    db: DbClient,
    repoId: string,
    commitSha: string,
    workspaceId: string,
  ): Promise<null | RepoSnapshot> {
    return db.repo.findUnique({
      select: {
        ...repoWithLatestAnalysisSelect,
        analyses: {
          orderBy: { createdAt: "desc" },
          select: latestCompletedAnalysisSelect,
          take: 1,
          where: { commitSha, status: "DONE" },
        },
      },
      where: { id: repoId, workspaceId },
    });
  },

  async getRepoDocsPayload(db: DbClient, repoId: string, workspaceId: string, aid?: string) {
    const repo = await db.repo.findUnique({
      select: {
        analyses: {
          orderBy: { createdAt: "desc" },
          select: analysisPayloadSelect,
          take: 1,
          where: { status: "DONE" },
        },
      },
      where: { id: repoId, workspaceId },
    });

    if (repo == null) {
      return null;
    }

    const target = await this.resolveTargetAnalysis(db, aid, workspaceId);

    if (target == null && repo.analyses.length === 0) {
      throw new AppError({
        code: "NOT_FOUND",
        messageCode: MessageCode.ANALYSIS_NOT_COMPLETED,
        publicMessage: "No completed analysis found",
      });
    }

    const documents = await loadDocumentsPerType(db, repoId, workspaceId, { aid, perType: 1 });

    if (target != null) {
      return { analyses: [target], documents };
    }

    return { ...repo, documents };
  },

  // The impact page needs the repo plus the analysis at the PR's head SHA, falling back to the
  // newest completed one. One heavy repo read; the head SHA costs one narrow analysis row, and only
  // when it is not the latest — an old commit can be any distance back in the history.
  async getRepoForImpact(
    db: DbClient,
    repoId: string,
    workspaceId: string,
    headSha: string,
  ): Promise<null | RepoSnapshot> {
    const repo = await db.repo.findUnique({
      select: repoWithLatestAnalysisSelect,
      where: { id: repoId, workspaceId },
    });

    if (repo == null) {
      return null;
    }

    const latest = repo.analyses[0];

    if (latest == null) {
      throw missingAnalysisError(undefined);
    }

    if (latest.commitSha === headSha) {
      return repo;
    }

    const pinned = await db.analysis.findFirst({
      orderBy: { createdAt: "desc" },
      select: latestCompletedAnalysisSelect,
      where: { commitSha: headSha, repo: { id: repoId, workspaceId }, status: "DONE" },
    });

    return pinned == null ? repo : { ...repo, analyses: [pinned] };
  },

  async getRepoRef(db: DbClient, repoId: string, workspaceId: string, aid?: string) {
    const repo = await db.repo.findUnique({
      select: {
        analyses: targetAnalysisArgs(aid, { id: true }),
        defaultBranch: true,
        id: true,
        name: true,
        owner: true,
        url: true,
      },
      where: { id: repoId, workspaceId },
    });

    if (repo == null) {
      return null;
    }

    const analysis = repo.analyses[0];

    if (analysis == null) {
      throw missingAnalysisError(aid);
    }

    return { ...repo, analysisId: analysis.id };
  },

  async getRepoSnapshot(db: DbClient, repoId: string, workspaceId: string, aid?: string) {
    const repo = await db.repo.findUnique({
      select: {
        ...repoWithLatestAnalysisSelect,
        analyses: targetAnalysisArgs(aid, latestCompletedAnalysisSelect),
      },
      where: { id: repoId, workspaceId },
    });

    if (repo == null) {
      return null;
    }

    if (repo.analyses.length === 0) {
      throw missingAnalysisError(aid);
    }

    return repo;
  },

  async loadImpactAnalysis(db: DbClient, repoId: string, prNumber: number, workspaceId: string) {
    return db.pullRequestAnalysis.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        _count: { select: { generatedFixes: true } },
        baseSha: true,
        changedFilesJson: true,
        createdAt: true,
        findingsJson: true,
        headSha: true,
        id: true,
        prNumber: true,
        riskScore: true,
        status: true,
        updatedAt: true,
      },
      where: {
        prNumber,
        repo: { id: repoId, workspaceId },
      },
    });
  },

  // One row per kind: search and the related-docs panel only ever showed the newest document of a
  // type, and a per-kind window stops one type's history from starving the others.
  async loadLatestDocumentsWithContent(
    db: DbClient,
    repoId: string,
    workspaceId: string,
    aid?: string,
  ) {
    return loadDocumentsPerType(db, repoId, workspaceId, {
      aid,
      perType: 1,
      withContent: true,
    });
  },

  async loadRelatedFixes(db: DbClient, analysisIds: string[], workspaceId: string) {
    const uniqueIds = uniq(analysisIds.filter((id) => id.length > 0));
    if (uniqueIds.length === 0) {
      return [];
    }

    const fixes = await db.generatedFix.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        githubPrNumber: true,
        githubPrUrl: true,
        id: true,
        status: true,
        title: true,
      },
      take: 8,
      where: {
        prAnalysis: {
          id: { in: uniqueIds },
          repo: { workspaceId },
        },
      },
    });

    return fixes.map((fix) => fixesMapper.toSummary(fix));
  },

  async loadRelatedPrFindings(
    db: DbClient,
    repoId: string,
    workspaceId: string,
    relatedFiles: string[],
  ) {
    if (relatedFiles.length === 0) {
      return [];
    }

    const comments = await db.pullRequestComment.findMany({
      orderBy: [{ analysis: { createdAt: "desc" } }, { riskLevel: "desc" }],
      select: {
        analysis: {
          select: {
            id: true,
            prNumber: true,
          },
        },
        body: true,
        filePath: true,
        findingType: true,
        id: true,
        line: true,
        riskLevel: true,
      },
      take: 12,
      where: {
        analysis: { repo: { id: repoId, workspaceId } },
        filePath: { in: relatedFiles },
      },
    });

    return comments.map((comment) => ({
      body: comment.body,
      filePath: comment.filePath,
      findingType: comment.findingType,
      id: comment.id,
      line: comment.line,
      prAnalysisId: comment.analysis.id,
      prNumber: comment.analysis.prNumber,
      riskLevel: comment.riskLevel,
    }));
  },

  async resolveTargetAnalysis(db: DbClient, aid: string | undefined, workspaceId: string) {
    if (aid == null) {
      return null;
    }

    const target = await db.analysis.findFirst({
      select: latestCompletedAnalysisSelect,
      where: { id: aid, repo: { workspaceId }, status: "DONE" },
    });

    if (target == null) {
      throw new AppError({
        code: "NOT_FOUND",
        messageCode: MessageCode.ANALYSIS_VERSION_NOT_FOUND,
        publicMessage: "Analysis version not found",
      });
    }

    return target;
  },

  async storeChangedFilesSnapshot(db: DbClient, id: string, changedFiles: PRChangedFileSnapshot[]) {
    return db.pullRequestAnalysis.update({
      data: {
        changedFilesJson: changedFiles,
      },
      where: { id },
    });
  },

  async updatePRAnalysis(db: DbClient, id: string, data: { baseSha?: string; headSha?: string }) {
    return db.pullRequestAnalysis.update({
      data: {
        ...(data.baseSha != null && { baseSha: data.baseSha }),
        ...(data.headSha != null && { headSha: data.headSha }),
      },
      where: { id },
    });
  },

  async updatePRAnalysisStatus(
    db: DbClient,
    id: string,
    status: PRAnalysisStatus,
    data?: {
      error?: string;
      findingsJson?: z.output<typeof persistedFindingSchema>[];
      riskScore?: number;
    },
  ) {
    return db.pullRequestAnalysis.update({
      data: {
        error: data?.error,
        riskScore: data?.riskScore,
        status,
        // `Prisma.InputJsonValue` excludes `undefined`, which is what `data?.findingsJson` is when `data` is omitted.
        ...(data?.findingsJson != null && { findingsJson: data.findingsJson }),
      },
      where: { id },
    });
  },

  async updateStatus(
    db: DbClient,
    id: string,
    status: FixStatus,
    data?: {
      estimatedImpact?: number;
      githubPrNumber?: number;
      githubPrUrl?: string;
    },
  ) {
    return db.generatedFix.update({
      data: {
        estimatedImpact: data?.estimatedImpact,
        githubPrNumber: data?.githubPrNumber,
        githubPrUrl: data?.githubPrUrl,
        status,
      },
      where: { id },
    });
  },
};
