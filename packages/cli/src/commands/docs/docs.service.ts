import { trpc } from "@/core/client";

export type DocType = "README" | "ARCHITECTURE" | "CODE_DOC";

export const docsService = {
  /**
   * Сгенерировать документацию для конкретного файла
   */
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
  /**
   * Получить список всех сгенерированных документов для репозитория
   */
  async getAvailableDocs(repoId: string, aid?: string) {
    return trpc.analysis.getAvailableDocs.query({ aid, repoId });
  },

  /**
   * Получить markdown-содержимое конкретного документа
   */
  async getDocumentContent(repoId: string, type: DocType, path?: string, aid?: string) {
    return trpc.analysis.getDocumentContent.query({
      aid,
      path,
      repoId,
      type: type,
    });
  },

  /**
   * Закрепить результаты аудита файла в документацию
   */
  async pinAuditToDocs(repoId: string, path: string) {
    return trpc.analysis.pinAuditToDocs.mutate({ path, repoId });
  },
};
