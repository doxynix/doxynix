import type { PRAnalysisConfig } from "@/server/modules/analysis/logic/pr.types";

import { appLogger as baseLogger } from "../core/app-logger";

/**
 * Structured logging for PR analysis operations
 */
export const prAnalysisLogger = {
  analyzeCompleted: (
    repoId: string,
    prNumber: number,
    totalDuration: number,
    findingsCount: number,
  ) => {
    baseLogger.info({
      findings: findingsCount,
      msg: "pr_analysis_completed",
      prNumber,
      repoId,
      totalDuration,
    });
  },

  analyzeFailed: (repoId: string, prNumber: number, error: string) => {
    baseLogger.error({ error, msg: "pr_analysis_failed", prNumber, repoId });
  },

  analyzeStarted: (repoId: string, prNumber: number, tokenBudget: number) => {
    baseLogger.info({
      msg: "pr_analysis_started",
      phase: "initialization",
      prNumber,
      repoId,
      tokenBudget,
    });
  },

  commentPostFailed: (repoId: string, prNumber: number, file: string, error: string) => {
    baseLogger.error({
      error,
      file,
      msg: "pr_comment_post_failed",
      prNumber,
      repoId,
    });
  },

  commentsPosted: (repoId: string, prNumber: number, commentCount: number) => {
    baseLogger.info({
      comments: commentCount,
      msg: "pr_comments_posted",
      prNumber,
      repoId,
    });
  },

  configUpdated: (repoId: string, config: PRAnalysisConfig) => {
    baseLogger.info({ config, msg: "pr_config_updated", repoId });
  },

  findingsScored: (repoId: string, prNumber: number, findingsCount: number, riskScore: number) => {
    baseLogger.info({
      msg: "pr_findings_scored",
      prNumber,
      repoId,
      riskScore,
      totalFindings: findingsCount,
    });
  },

  mapperPhaseCompleted: (repoId: string, prNumber: number, findings: number, duration: number) => {
    baseLogger.info({
      duration,
      findings,
      msg: "pr_analysis_phase",
      phase: "mapper",
      prNumber,
      repoId,
      status: "completed",
    });
  },

  rateLimitWarning: (remainingRequests: number) => {
    baseLogger.warn({ msg: "github_rate_limit_warning", remaining: remainingRequests });
  },

  sentinelPhaseCompleted: (
    repoId: string,
    prNumber: number,
    findingsCount: number,
    duration: number,
  ) => {
    baseLogger.info({
      duration,
      findings: findingsCount,
      msg: "pr_analysis_phase",
      phase: "sentinel",
      prNumber,
      repoId,
      status: "completed",
    });
  },

  sentinelPhaseStarted: (repoId: string, prNumber: number) => {
    baseLogger.info({
      msg: "pr_analysis_phase",
      phase: "sentinel",
      prNumber,
      repoId,
      status: "started",
    });
  },

  webhookProcessed: (owner: string, repo: string, prNumber: number) => {
    baseLogger.info({ msg: "pr_webhook_processed", owner, prNumber, repo });
  },
};
