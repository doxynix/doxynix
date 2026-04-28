// TODO: подумать как его нормально разнести

import { type Prisma } from "@prisma/client";

import type { DbClient } from "@/server/shared/infrastructure/db";

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

export function toAnalysisRef(
  analysis: null | Pick<LatestCompletedAnalysis, "commitSha" | "createdAt" | "publicId"> | undefined
): AnalysisRef | null {
  if (analysis == null) return null;

  return {
    analysisId: analysis.publicId,
    commitSha: analysis.commitSha,
    createdAt: analysis.createdAt,
  };
}

export async function getRepoWithLatestAnalysisAndDocs(db: DbClient, repoId: string) {
  return db.repo.findUnique({
    select: repoWithLatestAnalysisAndDocsSelect,
    where: { publicId: repoId },
  }) as Promise<null | RepoWithLatestAnalysisAndDocs>;
}

export async function getLatestCompletedAnalysis(db: DbClient, repoId: string) {
  return db.analysis.findFirst({
    orderBy: { createdAt: "desc" },
    select: latestCompletedAnalysisSelect,
    where: { repo: { publicId: repoId }, status: "DONE" },
  }) as Promise<LatestCompletedAnalysis | null>;
}

export async function getLatestCompletedAnalysisRef(db: DbClient, repoId: string) {
  const analysis = await getLatestCompletedAnalysis(db, repoId);
  return toAnalysisRef(analysis);
}

export async function getRepoWithAnalysisByCommitSha(
  db: DbClient,
  repoId: string,
  commitSha: string
) {
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
}
