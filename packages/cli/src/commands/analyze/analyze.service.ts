import { trpc } from "@/core/client";

export const analyzeService = {
  async configureRepository(input: any) {
    return trpc.analysis.configureRepository.mutate(input);
  },

  async getFileActionResult(repoId: string, path: string) {
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
