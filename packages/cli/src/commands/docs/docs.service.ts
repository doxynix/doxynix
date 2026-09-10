import { trpc } from "@/core/client";

import type { DocType } from "./docs.types";

export const docsService = {
  async documentFile(input: {
    repoId: string;
    path: string;
    content: string;
    branch?: string;
    commitSha?: string;
    language?: string;
    analysisId?: string;
  }) {
    return trpc.analysis.documentFile.mutate({
      analysisId: input.analysisId,
      branch: input.branch ?? "main",
      commitSha: input.commitSha,
      content: input.content,
      language: input.language ?? "English",
      path: input.path,
      repoId: input.repoId,
    });
  },

  async getAvailableDocs(repoId: string, aid?: string) {
    return trpc.analysis.getAvailableDocs.query({ aid, repoId });
  },

  async getDocumentContent(repoId: string, type: DocType, path?: string, aid?: string) {
    return trpc.analysis.getDocumentContent.query({
      aid,
      path,
      repoId,
      type: type,
    });
  },

  async pinAuditToDocs(repoId: string, path: string) {
    return trpc.analysis.pinAuditToDocs.mutate({ path, repoId });
  },
};
