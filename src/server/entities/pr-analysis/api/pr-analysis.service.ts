import { PRAnalysisStatus } from "@prisma/client";

import type { DbClient } from "@/server/shared/infrastructure/db";
import type { PRChangedFileSnapshot } from "@/server/shared/types";

type PRAnalysisCreateInput = {
  baseSha: string;
  headSha: string;
  owner: string;
  prNumber: number;
  repoId: string;
  repoName: string;
};

type PRFinding = {
  file: string;
  line: number;
  message: string;
  severity: "high" | "low" | "medium";
  suggestion?: string;
  type: string;
};

export const prAnalysisService = {
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

  async create(db: DbClient, input: PRAnalysisCreateInput) {
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

  async storeChangedFilesSnapshot(db: DbClient, id: number, changedFiles: PRChangedFileSnapshot[]) {
    return db.pullRequestAnalysis.update({
      data: {
        changedFilesJson: changedFiles,
      },
      where: { id },
    });
  },

  async update(db: DbClient, id: number, data: { baseSha?: string; headSha?: string }) {
    return db.pullRequestAnalysis.update({
      data: {
        ...(data.baseSha != null && { baseSha: data.baseSha }),
        ...(data.headSha != null && { headSha: data.headSha }),
      },
      where: { id },
    });
  },

  async updateStatus(
    db: DbClient,
    id: number,
    status: PRAnalysisStatus,
    data?: { error?: string; findingsJson?: PRFinding[]; riskScore?: number }
  ) {
    return db.pullRequestAnalysis.update({
      data: {
        error: data?.error,
        findingsJson: data?.findingsJson,
        riskScore: data?.riskScore,
        status,
      },
      where: { id },
    });
  },
};
