import { trpc } from "@/core/client";

import {
  type ConfigureRepositoryInput,
  type GetDetailedMetricsInput,
  type GetStructureMapInput,
  type QuickFileAuditInput,
  type SearchWorkspaceInput,
  type StartAnalysisInput,
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
    return trpc.analysis.getHistory.query({ repoId });
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
