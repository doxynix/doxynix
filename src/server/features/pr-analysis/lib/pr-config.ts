import { PRCommentStyle, PRFocusArea } from "@prisma/client";

import { PATH_PATTERNS } from "@/server/shared/engine/core/project-policy-rules";
import type { DbClient } from "@/server/shared/infrastructure/db";

import type { PRAnalysisConfig } from "../model/pr-types";

const SYSTEM_IGNORES = [
  ...PATH_PATTERNS.IGNORE,
  ...PATH_PATTERNS.GENERATED,
  ...PATH_PATTERNS.ASSET,
];

const DEFAULT_PR_CONFIG: PRAnalysisConfig = {
  ciSkip: false,
  commentStyle: PRCommentStyle.DETAILED,
  enabled: false,
  excludePatterns: SYSTEM_IGNORES,
  focusAreas: [PRFocusArea.SECURITY, PRFocusArea.PERFORMANCE],
  tokenBudget: 30_000,
};

export class PRConfigService {
  static async getConfig(repoId: string, db: DbClient): Promise<PRAnalysisConfig> {
    const config = await db.pullRequestAnalysisConfig.findFirst({
      where: { repo: { publicId: repoId } },
    });

    if (config == null) return DEFAULT_PR_CONFIG;

    return {
      ciSkip: config.ciSkip,
      commentStyle: config.commentStyle,
      enabled: config.enabled,
      excludePatterns: Array.from(new Set([...SYSTEM_IGNORES, ...config.excludePatterns])),
      focusAreas: config.focusAreas,
      tokenBudget: config.tokenBudget,
    };
  }

  static async updateConfig(
    repoId: string,
    config: Partial<PRAnalysisConfig>,
    db: DbClient
  ): Promise<PRAnalysisConfig> {
    const cleanUpdate = Object.fromEntries(Object.entries(config));

    await db.repo.update({
      data: {
        prAnalysisConfig: {
          upsert: {
            create: {
              ciSkip: config.ciSkip ?? DEFAULT_PR_CONFIG.ciSkip,
              commentStyle: config.commentStyle ?? DEFAULT_PR_CONFIG.commentStyle,
              enabled: config.enabled ?? DEFAULT_PR_CONFIG.enabled,
              excludePatterns: config.excludePatterns ?? [],
              focusAreas: config.focusAreas ?? DEFAULT_PR_CONFIG.focusAreas,
              tokenBudget: config.tokenBudget ?? DEFAULT_PR_CONFIG.tokenBudget,
            },
            update: cleanUpdate,
          },
        },
      },
      where: { publicId: repoId },
    });

    return this.getConfig(repoId, db);
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
