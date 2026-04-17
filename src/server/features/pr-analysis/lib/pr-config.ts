import { PATH_PATTERNS } from "@/server/shared/engine/core/project-policy-rules";
import { prisma } from "@/server/shared/infrastructure/db";

import type { PRAnalysisConfig } from "../model/pr-types";

const DEFAULT_PR_CONFIG: PRAnalysisConfig = {
  ciSkip: false,
  commentStyle: "detailed",
  enabled: false,
  excludePatterns: [...PATH_PATTERNS.IGNORE, ...PATH_PATTERNS.GENERATED, ...PATH_PATTERNS.ASSET],
  focusAreas: ["security", "performance"],
  tokenBudget: 30_000,
};

export class PRConfigService {
  static async getConfig(repoId: number): Promise<PRAnalysisConfig> {
    const repo = await prisma.repo.findUnique({
      select: { prAnalysisConfig: true },
      where: { id: repoId },
    });

    if (repo?.prAnalysisConfig == null) {
      return DEFAULT_PR_CONFIG;
    }

    return {
      ...DEFAULT_PR_CONFIG,
      ...(repo.prAnalysisConfig as Partial<PRAnalysisConfig>),
    };
  }

  static async updateConfig(
    repoId: number,
    config: Partial<PRAnalysisConfig>
  ): Promise<PRAnalysisConfig> {
    const currentConfig = await this.getConfig(repoId);
    const newConfig = {
      ...currentConfig,
      ...config,
    };

    await prisma.repo.update({
      data: {
        prAnalysisConfig: newConfig as PRAnalysisConfig,
      },
      where: { id: repoId },
    });

    return newConfig;
  }

  static async enablePRAnalysis(repoId: number): Promise<void> {
    await this.updateConfig(repoId, { enabled: true });
  }

  static async disablePRAnalysis(repoId: number): Promise<void> {
    await this.updateConfig(repoId, { enabled: false });
  }

  static async setTokenBudget(repoId: number, budget: number): Promise<void> {
    await this.updateConfig(repoId, { tokenBudget: Math.max(10_000, Math.min(100_000, budget)) });
  }

  static async setFocusAreas(repoId: number, areas: PRAnalysisConfig["focusAreas"]): Promise<void> {
    await this.updateConfig(repoId, { focusAreas: areas });
  }
}
