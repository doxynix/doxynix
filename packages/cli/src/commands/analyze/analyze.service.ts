import { collectCursorPages, MAX_PAGE_SIZE } from "@doxynix/shared";

import { trpc } from "@/core/client";

import type {
  AnalysisHistoryPage,
  ConfigureRepositoryInput,
  GetDetailedMetricsInput,
  GetStructureMapInput,
  QuickFileAuditInput,
  SearchWorkspaceInput,
  StartAnalysisInput,
} from "./analyze.types";

export const analyzeService = {
  async analyze(input: StartAnalysisInput) {
    return trpc.analysis.analyze.mutate(input);
  },

  async cancel(analysisId: string) {
    return trpc.analysis.cancel.mutate({ analysisId });
  },

  async configureRepository(input: ConfigureRepositoryInput) {
    return trpc.analysis.configureRepository.mutate(input);
  },

  async getDetailedMetrics(input: GetDetailedMetricsInput) {
    return trpc.analysis.getDetailedMetrics.query(input);
  },

  async getHistory(repoId: string) {
    const pages: AnalysisHistoryPage[] = [];

    // Walks every page so a run older than the first one still resolves; `hasNextPage`
    // survives only when the shared page bound truncates the walk.
    const items = await collectCursorPages(async (cursor) => {
      const page = await trpc.analysis.getHistory.query({ cursor, limit: MAX_PAGE_SIZE, repoId });
      pages.push(page);
      return page;
    });

    const last = pages.at(-1);

    return {
      items,
      meta: { hasNextPage: last?.meta.hasNextPage ?? false, nextCursor: last?.meta.nextCursor },
      total: pages[0]?.total ?? 0,
    };
  },

  async getLatest(repoId: string) {
    return trpc.analysis.getLatest.query({ repoId });
  },

  async getRepoConfig(repoId: string) {
    return trpc.analysis.getRepoConfig.query({ repoId });
  },

  async getStructureMap(input: GetStructureMapInput) {
    return trpc.analysis.getStructureMap.query(input);
  },

  async quickFileAudit(input: QuickFileAuditInput) {
    return trpc.analysis.quickFileAudit.mutate(input);
  },

  async searchWorkspace(input: SearchWorkspaceInput) {
    return trpc.analysis.searchWorkspace.query(input);
  },
};
