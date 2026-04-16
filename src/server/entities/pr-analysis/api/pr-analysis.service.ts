import { PRAnalysisStatus } from "@prisma/client";

import type { DbClient } from "@/server/shared/infrastructure/db";

type PRAnalysisCreateInput = {
  baseSha: string;
  headSha: string;
  owner: string;
  prNumber: number;
  repoId: number;
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
  addComments: async (
    db: DbClient,
    analysisId: number,
    comments: Array<{
      body: string;
      filePath: string;
      findingType: string;
      line: number;
      riskLevel: number;
    }>
  ) => {
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

  create: async (db: DbClient, input: PRAnalysisCreateInput) => {
    return db.pullRequestAnalysis.create({
      data: {
        baseSha: input.baseSha,
        headSha: input.headSha,
        owner: input.owner,
        prNumber: input.prNumber,
        repoId: input.repoId,
        repoName: input.repoName,
        status: PRAnalysisStatus.PENDING,
      },
    });
  },

  async getById(db: DbClient, id: number) {
    return db.pullRequestAnalysis.findUnique({
      include: {
        comments: true,
        generatedFixes: true,
      },
      where: { id },
    });
  },

  async getByRepoAndPRNumber(db: DbClient, repoId: number, prNumber: number) {
    return db.pullRequestAnalysis.findUnique({
      include: {
        comments: true,
        generatedFixes: true,
      },
      where: {
        repoId_prNumber: { prNumber, repoId },
      },
    });
  },

  async getCommentsByAnalysis(db: DbClient, analysisId: number) {
    return db.pullRequestComment.findMany({
      orderBy: [{ filePath: "asc" }, { line: "asc" }],
      where: { analysisId },
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
        findingsJson: data?.findingsJson as PRFinding[],
        riskScore: data?.riskScore,
        status,
      },
      where: { id },
    });
  },
};
