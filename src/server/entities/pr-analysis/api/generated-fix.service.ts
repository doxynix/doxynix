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
      prAnalysisId?: string;
      repoId: number;
      title: string;
    }
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
          prAnalysis: { connect: { publicId: input.prAnalysisId } },
        }),
      },
    });
  },

  async getById(db: DbClient, id: string) {
    return db.generatedFix.findUnique({
      where: { publicId: id },
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
