import { PRAnalysisStatus, type FixStatus, type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { uniq } from "es-toolkit";

import type { DbClient } from "@/server/core/db";
import type { PRChangedFileSnapshot } from "@/server/utils/types";

import { pickLatestDocsByType } from "./analysis.utils";

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
  metricsJson: true,
  onboardingScore: true,
  publicId: true,
  resultJson: true,
  score: true,
  securityScore: true,
  status: true,
  techDebtScore: true,
} satisfies Prisma.AnalysisSelect;

export type LatestCompletedAnalysis = Prisma.AnalysisGetPayload<{
  select: typeof latestCompletedAnalysisSelect;
}>;

export const repoWithLatestAnalysisAndDocsSelect = {
  analyses: {
    orderBy: { createdAt: "desc" },
    select: latestCompletedAnalysisSelect,
    take: 1,
    where: { status: "DONE" },
  },
  defaultBranch: true,
  description: true,
  documents: {
    orderBy: { updatedAt: "desc" },
    select: {
      analysis: {
        select: {
          publicId: true,
        },
      },
      createdAt: true,
      publicId: true,
      type: true,
      updatedAt: true,
      version: true,
    },
  },
  forks: true,
  language: true,
  license: true,
  name: true,
  openIssues: true,
  owner: true,
  ownerAvatarUrl: true,
  publicId: true,
  pushedAt: true,
  size: true,
  stars: true,
  topics: true,
  url: true,
  visibility: true,
} satisfies Prisma.RepoSelect;

export type RepoWithLatestAnalysisAndDocs = Prisma.RepoGetPayload<{
  select: typeof repoWithLatestAnalysisAndDocsSelect;
}>;

export type AnalysisRef = {
  analysisId: string;
  commitSha: null | string;
  createdAt: Date;
};

export const analysisRepo = {
  async addComments(
    db: DbClient,
    analysisId: number,
    comments: Array<{
      body: string;
      filePath: string;
      findingType: string;
      line: number;
      riskLevel: number;
    }>
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
    }
  ) {
    return db.generatedFix.create({
      data: {
        branch: input.branch,
        createdByUser: input.createdByUser ?? false,
        description: input.description,
        repo: { connect: { publicId: input.repoId } },
        status: "DRAFT",
        title: input.title,
        ...(input.prAnalysisId != null && {
          prAnalysis: { connect: { publicId: input.prAnalysisId } },
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
            publicId: input.repoId,
          },
        },
        repoName: input.repoName,
        status: PRAnalysisStatus.PENDING,
      },
    });
  },

  async getById(db: DbClient, id: string) {
    return db.generatedFix.findUnique({
      where: { publicId: id },
    });
  },

  async getByRepoAndPRNumber(db: DbClient, repoId: string, prNumber: number) {
    return db.pullRequestAnalysis.findFirst({
      include: {
        comments: true,
        generatedFixes: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        prNumber,
        repo: {
          publicId: repoId,
        },
      },
    });
  },

  async getByRepoId(db: DbClient, repoPublicId: string, status?: FixStatus) {
    return db.generatedFix.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        repo: {
          publicId: repoPublicId,
        },
        ...(status != null && { status }),
      },
    });
  },
  async getLatestRef(db: DbClient, repoId: string): Promise<AnalysisRef | null> {
    const analysis = await db.analysis.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        commitSha: true,
        createdAt: true,
        publicId: true,
      },
      where: { repo: { publicId: repoId }, status: "DONE" },
    });

    if (analysis == null) return null;

    return {
      analysisId: analysis.publicId,
      commitSha: analysis.commitSha,
      createdAt: analysis.createdAt,
    };
  },

  async getRepoBySha(
    db: DbClient,
    repoId: string,
    commitSha: string
  ): Promise<null | RepoWithLatestAnalysisAndDocs> {
    return db.repo.findUnique({
      select: {
        ...repoWithLatestAnalysisAndDocsSelect,
        analyses: {
          select: latestCompletedAnalysisSelect,
          take: 1,
          where: { commitSha, status: "DONE" },
        },
      },
      where: { publicId: repoId },
    }) as Promise<null | RepoWithLatestAnalysisAndDocs>;
  },

  async getRepoSnapshot(db: DbClient, repoId: string, aid?: string) {
    const repo = await db.repo.findUnique({
      select: repoWithLatestAnalysisAndDocsSelect,
      where: { publicId: repoId },
    });

    if (repo == null) return null;

    if (aid != null) {
      const targetAnalysis = await db.analysis.findFirst({
        select: latestCompletedAnalysisSelect,
        where: { publicId: aid, status: "DONE" },
      });

      if (targetAnalysis == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analysis version not found" });
      }

      return {
        ...repo,
        analyses: [targetAnalysis],
        documents: repo.documents.filter((d) => d.analysis?.publicId === aid),
      } as RepoWithLatestAnalysisAndDocs;
    }

    if (repo.analyses.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No completed analysis found" });
    }

    return repo;
  },

  async loadImpactAnalysis(db: DbClient, repoId: string, prNumber: number) {
    return db.pullRequestAnalysis.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        baseSha: true,
        changedFilesJson: true,
        comments: {
          orderBy: [{ riskLevel: "desc" }, { filePath: "asc" }, { line: "asc" }],
          select: {
            body: true,
            filePath: true,
            findingType: true,
            line: true,
            publicId: true,
            riskLevel: true,
          },
        },
        createdAt: true,
        findingsJson: true,
        generatedFixes: {
          orderBy: { createdAt: "desc" },
          select: {
            githubPrNumber: true,
            githubPrUrl: true,
            publicId: true,
            status: true,
            title: true,
          },
        },
        headSha: true,
        prNumber: true,
        publicId: true,
        riskScore: true,
        status: true,
      },
      where: {
        prNumber,
        repo: { publicId: repoId },
      },
    });
  },

  async loadLatestDocumentsWithContent(db: DbClient, repoId: string, aid?: string) {
    const docs = await db.document.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        analysis: { select: { publicId: true } },
        content: true,
        publicId: true,
        type: true,
        updatedAt: true,
        version: true,
      },
      where: {
        repo: { publicId: repoId },
        ...(aid != null ? { analysis: { publicId: aid } } : {}),
      },
    });

    return pickLatestDocsByType(docs);
  },

  async loadRelatedFixes(db: DbClient, analysisIds: string[]) {
    const uniqueIds = uniq(analysisIds.filter((id) => id.length > 0));
    if (uniqueIds.length === 0) return [];

    const fixes = await db.generatedFix.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        githubPrNumber: true,
        githubPrUrl: true,
        publicId: true,
        status: true,
        title: true,
      },
      take: 8,
      where: {
        prAnalysis: {
          publicId: { in: uniqueIds },
        },
      },
    });

    return fixes.map((fix) => ({
      githubPrNumber: fix.githubPrNumber,
      githubPrUrl: fix.githubPrUrl,
      id: fix.publicId,
      status: fix.status,
      title: fix.title,
    }));
  },

  async loadRelatedPrFindings(db: DbClient, repoId: string, relatedFiles: string[]) {
    if (relatedFiles.length === 0) return [];

    const comments = await db.pullRequestComment.findMany({
      orderBy: [{ analysis: { createdAt: "desc" } }, { riskLevel: "desc" }],
      select: {
        analysis: {
          select: {
            prNumber: true,
            publicId: true,
          },
        },
        body: true,
        filePath: true,
        findingType: true,
        line: true,
        publicId: true,
        riskLevel: true,
      },
      take: 12,
      where: {
        analysis: { repo: { publicId: repoId } },
        filePath: { in: relatedFiles },
      },
    });

    return comments.map((comment) => ({
      body: comment.body,
      filePath: comment.filePath,
      findingType: comment.findingType,
      id: comment.publicId,
      line: comment.line,
      prAnalysisId: comment.analysis.publicId,
      prNumber: comment.analysis.prNumber,
      riskLevel: comment.riskLevel,
    }));
  },

  async storeChangedFilesSnapshot(db: DbClient, id: number, changedFiles: PRChangedFileSnapshot[]) {
    return db.pullRequestAnalysis.update({
      data: {
        changedFilesJson: changedFiles,
      },
      where: { id },
    });
  },

  async updatePRAnalysis(db: DbClient, id: number, data: { baseSha?: string; headSha?: string }) {
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
    id: number,
    status: PRAnalysisStatus,
    // `findingsJson` can be a validated JSON payload; keep it untyped here to allow
    // passing different persisted shapes (validated via Zod where appropriate).
    data?: { error?: string; findingsJson?: unknown; riskScore?: number }
  ) {
    return db.pullRequestAnalysis.update({
      data: {
        error: data?.error,
        findingsJson: data?.findingsJson as Prisma.InputJsonValue,
        riskScore: data?.riskScore,
        status,
      },
      where: { id },
    });
  },

  /**
   * Update fix status. NO diff storage.
   * Only githubPrUrl, githubPrNumber, estimatedImpact are persisted.
   */
  async updateStatus(
    db: DbClient,
    id: string,
    status: FixStatus,
    data?: {
      estimatedImpact?: number;
      githubPrNumber?: number;
      githubPrUrl?: string;
    }
  ) {
    return db.generatedFix.update({
      data: {
        estimatedImpact: data?.estimatedImpact,
        githubPrNumber: data?.githubPrNumber,
        githubPrUrl: data?.githubPrUrl,
        status,
      },
      where: { publicId: id },
    });
  },
};
