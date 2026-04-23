import { PATH_PATTERNS } from "@/server/shared/engine/core/project-policy-rules";
import type { DbClient } from "@/server/shared/infrastructure/db";

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
  static async getConfig(repoId: string, db: DbClient): Promise<PRAnalysisConfig> {
    const repo = await db.repo.findUnique({
      select: { prAnalysisConfig: true },
      where: { publicId: repoId },
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
    repoId: string,
    config: Partial<PRAnalysisConfig>,
    db: DbClient
  ): Promise<PRAnalysisConfig> {
    const currentConfig = await this.getConfig(repoId, db);
    const newConfig = {
      ...currentConfig,
      ...config,
    };

    await db.repo.update({
      data: {
        prAnalysisConfig: newConfig as PRAnalysisConfig,
      },
      where: { publicId: repoId },
    });

    return newConfig;
  }

  static async enablePRAnalysis(repoId: string, db: DbClient): Promise<void> {
    await this.updateConfig(repoId, { enabled: true }, db);
  }

  static async disablePRAnalysis(repoId: string, db: DbClient): Promise<void> {
    await this.updateConfig(repoId, { enabled: false }, db);
  }

  static async setTokenBudget(repoId: string, budget: number, db: DbClient): Promise<void> {
    await this.updateConfig(
      repoId,
      { tokenBudget: Math.max(10_000, Math.min(100_000, budget)) },
      db
    );
  }

  static async setFocusAreas(
    repoId: string,
    areas: PRAnalysisConfig["focusAreas"],
    db: DbClient
  ): Promise<void> {
    await this.updateConfig(repoId, { focusAreas: areas }, db);
  }
}
