import type { FixStatus } from "@prisma/client";

import type { DbClient } from "@/server/shared/infrastructure/db";

/**
 * PRIVACY FIRST: GeneratedFix stores ONLY metadata. Diffs are ephemeral (in-memory)
 * and never persisted to Postgres. This prevents code storage violations.
 */
export const generatedFixService = {
  async create(
    db: DbClient,
    input: {
      branch: string;
      createdByUser?: boolean;
      description?: string;
      prAnalysisId?: number;
      repoId: number;
      title: string;
    }
  ) {
    return db.generatedFix.create({
      data: {
        branch: input.branch,
        createdByUser: input.createdByUser ?? false,
        description: input.description,
        prAnalysisId: input.prAnalysisId,
        repoId: input.repoId,
        status: "DRAFT" as const,
        title: input.title,
        // IMPORTANT: diffJson is NOT set here. Diffs are transient.
      },
    });
  },

  async getById(db: DbClient, id: number) {
    return db.generatedFix.findUnique({
      where: { id },
    });
  },

  async getByRepoId(db: DbClient, repoId: number, status?: FixStatus) {
    return db.generatedFix.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        repoId,
        ...(status && { status }),
      },
    });
  },

  /**
   * Update fix status. NO diff storage.
   * Only githubPrUrl, githubPrNumber, estimatedImpact are persisted.
   */
  async updateStatus(
    db: DbClient,
    id: number,
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
        // IMPORTANT: diffJson explicitly NOT updated. Use transient diffs in routes.
      },
      where: { id },
    });
  },
};
