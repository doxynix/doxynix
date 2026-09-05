import { trpc } from "@/core/client";

export const prService = {
  async getFixById(fixId: string) {
    return trpc.analysis.getById.query({ fixId });
  },

  async getFixes(repoId: string) {
    return trpc.analysis.getByRepository.query({ repoId });
  },
  async listByRepository(repoId: string) {
    return trpc.analysis.listByRepository.query({ repoId });
  },

  async openPullRequest(repoId: string, title: string, branch: string) {
    return trpc.analysis.openPullRequest.mutate({
      branch,
      repoId,
      title,
    });
  },

  async postComment(repoId: string, prNumber: number, body: string) {
    return trpc.analysis.postCommentToPR.mutate({
      body,
      prNumber,
      repoId,
    });
  },
};
