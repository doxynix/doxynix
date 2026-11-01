import { PRCommentStyle, PRFocusArea } from "@doxynix/shared";
import { clamp } from "es-toolkit";

import type { DbClient } from "@/server/core/db";
import { PATH_PATTERNS } from "@/server/core/path-classify/patterns";

import type { PRAnalysisConfig } from "./pr.types";

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

export const PRConfigService = {
  async disablePRAnalysis(repoId: string, workspaceId: string, db: DbClient): Promise<void> {
    await this.updateConfig(repoId, { enabled: false }, workspaceId, db);
  },

  async enablePRAnalysis(repoId: string, workspaceId: string, db: DbClient): Promise<void> {
    await this.updateConfig(repoId, { enabled: true }, workspaceId, db);
  },

  async getConfig(repoId: string, workspaceId: string, db: DbClient): Promise<PRAnalysisConfig> {
    const config = await db.pullRequestAnalysisConfig.findFirst({
      where: { repo: { workspaceId }, repoId },
    });

    if (config == null) {
      return DEFAULT_PR_CONFIG;
    }

    return {
      ciSkip: config.ciSkip,
      commentStyle: config.commentStyle,
      enabled: config.enabled,
      excludePatterns: Array.from(new Set([...SYSTEM_IGNORES, ...config.excludePatterns])),
      focusAreas: config.focusAreas,
      tokenBudget: config.tokenBudget,
    };
  },

  async setFocusAreas(
    repoId: string,
    areas: PRAnalysisConfig["focusAreas"],
    workspaceId: string,
    db: DbClient,
  ): Promise<void> {
    await this.updateConfig(repoId, { focusAreas: areas }, workspaceId, db);
  },

  async setTokenBudget(
    repoId: string,
    budget: number,
    workspaceId: string,
    db: DbClient,
  ): Promise<void> {
    await this.updateConfig(
      repoId,
      { tokenBudget: clamp(budget, 10_000, 100_000) },
      workspaceId,
      db,
    );
  },

  async updateConfig(
    repoId: string,
    config: Partial<PRAnalysisConfig>,
    workspaceId: string,
    db: DbClient,
  ): Promise<PRAnalysisConfig> {
    const entries = Object.entries(config);
    const cleanUpdate: Partial<PRAnalysisConfig> = Object.fromEntries(entries);

    if (cleanUpdate.tokenBudget == null) {
      delete cleanUpdate.tokenBudget;
    } else {
      cleanUpdate.tokenBudget = clamp(cleanUpdate.tokenBudget, 10_000, 100_000);
    }

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
              tokenBudget: cleanUpdate.tokenBudget ?? DEFAULT_PR_CONFIG.tokenBudget,
            },
            update: cleanUpdate,
          },
        },
      },
      where: { id: repoId, workspaceId },
    });

    return this.getConfig(repoId, workspaceId, db);
  },
};
