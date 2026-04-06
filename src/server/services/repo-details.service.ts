import { unstable_cache } from "next/cache";
import type { DocType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { highlightCode } from "@/shared/lib/shiki";

import {
  repoDetailsPresenter,
  type LatestCompletedAnalysis,
  type RepoWithLatestAnalysisAndDocs,
} from "@/server/api/presenters/repo-details.presenter";
import type { DbClient } from "@/server/infrastructure/db";
import { markdownToHtml } from "@/server/utils/markdown-to-html";

async function getRepoWithLatestAnalysisAndDocs(db: DbClient, repoId: string) {
  return db.repo.findUnique({
    select: {
      analyses: {
        orderBy: { createdAt: "desc" },
        select: {
          complexityScore: true,
          createdAt: true,
          metricsJson: true,
          onboardingScore: true,
          resultJson: true,
          score: true,
          securityScore: true,
          status: true,
          techDebtScore: true,
        },
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
    },
    where: { publicId: repoId },
  }) as Promise<RepoWithLatestAnalysisAndDocs | null>;
}

async function getLatestCompletedAnalysis(db: DbClient, repoId: string) {
  return db.analysis.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      complexityScore: true,
      metricsJson: true,
      onboardingScore: true,
      resultJson: true,
      score: true,
      securityScore: true,
      techDebtScore: true,
    },
    where: { repo: { publicId: repoId }, status: "DONE" },
  }) as Promise<LatestCompletedAnalysis | null>;
}

export const repoDetailsService = {
  async getAvailableDocs(db: DbClient, repoId: string) {
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);
    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });

    return repoDetailsPresenter.toAvailableDocs(repo);
  },

  async getDetailedMetrics(db: DbClient, repoId: string) {
    const analysis = await getLatestCompletedAnalysis(db, repoId);
    return repoDetailsPresenter.toDetailedMetrics(analysis);
  },

  async getDocumentContent(db: DbClient, repoId: string, type: DocType) {
    const doc = await db.document.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        repo: { publicId: repoId },
        type,
      },
    });

    if (doc == null) throw new TRPCError({ code: "NOT_FOUND" });

    const html = await unstable_cache(
      async () => markdownToHtml(doc.content),
      [`doc-html-${doc.publicId}`],
      {
        revalidate: false,
        tags: ["docs", doc.publicId],
      }
    )();

    return { html, id: doc.publicId };
  },

  async getHistory(db: DbClient, repoId: string) {
    const history = await db.analysis.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        commitSha: true,
        createdAt: true,
        message: true,
        publicId: true,
        score: true,
        status: true,
      },
      where: { repo: { publicId: repoId } },
    });

    return history.map((h) => ({
      commitSha: h.commitSha,
      createdAt: h.createdAt,
      id: h.publicId,
      message: h.message,
      score: h.score,
      status: h.status,
    }));
  },

  async getOverview(db: DbClient, repoId: string) {
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
    return repoDetailsPresenter.toOverview(repo);
  },

  async highlightFile(content: string, path: string) {
    const ext = path.split(".").pop() ?? "txt";
    const html = await highlightCode(content, ext);
    return { html };
  },
};
