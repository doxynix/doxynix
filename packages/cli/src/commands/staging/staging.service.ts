import { trpc } from "@/core/client";

export const stagingService = {
  async clearStaging(repoId: string) {
    return trpc.analysis.clearStaging.mutate({ repoId });
  },
  async getStagedFiles(repoId: string) {
    return trpc.analysis.getStagedFiles.query({ repoId });
  },

  async stageFile(repoId: string, filePath: string, content: string) {
    return trpc.analysis.stageFile.mutate({
      content,
      filePath,
      repoId,
    });
  },

  async unstageFile(repoId: string, filePath: string) {
    return trpc.analysis.unstageFile.mutate({
      filePath,
      repoId,
    });
  },
};
