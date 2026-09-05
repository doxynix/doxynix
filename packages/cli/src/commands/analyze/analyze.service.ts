import { trpc } from "@/core/client";

export interface UpdateRepoConfigInput {
  repoId: string;
  enabled?: boolean;
  ciSkip?: boolean;
  commentStyle?: string;
  focusAreas?: string[];
  tokenBudget?: number;
}

export const analyzeService = {
  async configureRepository(input: UpdateRepoConfigInput) {
    return trpc.analysis.configureRepository.mutate(input as any);
  },

  async getFileActionResult(path: string) {
    return trpc.analysis.getFileActionResult.query({
      action: "quick-file-audit",
      path,
    });
  },

  async getRepoConfig(repoId: string) {
    return trpc.analysis.getRepoConfig.query({ repoId });
  },
  async quickFileAudit(input: {
    repoId: string;
    path: string;
    content: string;
    branch?: string;
    commitSha?: string;
    language?: string;
    analysisId?: string;
  }) {
    return trpc.analysis.quickFileAudit.mutate({
      analysisId: input.analysisId,
      branch: input.branch ?? "main",
      commitSha: input.commitSha,
      content: input.content,
      language: input.language ?? "English",
      path: input.path,
      repoId: input.repoId,
    });
  },
};
