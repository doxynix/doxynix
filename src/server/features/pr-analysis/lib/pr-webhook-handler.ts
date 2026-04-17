import type { PullRequestEvent } from "@octokit/webhooks-types";

import { prAnalysisService } from "@/server/entities/pr-analysis/api/pr-analysis.service";
import { PRConfigService } from "@/server/features/pr-analysis/lib/pr-config";
import { prisma } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";

import { analyzePrTask } from "../task/analyze-pr.task";

/**
 * Handle GitHub PR webhook events (opened, synchronize actions only)
 * Validates config, creates analysis record, and triggers Trigger.dev task for differential analysis
 */
export async function handlePullRequestEvent(payload: PullRequestEvent): Promise<void> {
  const { action, pull_request, repository } = payload;

  if (pull_request.user.type === "Bot") {
    logger.debug({
      bot: pull_request.user.login,
      msg: "pr_webhook_ignored_bot",
      prNumber: pull_request.number,
    });
    return;
  }

  if (pull_request.draft) {
    logger.debug({ msg: "pr_webhook_skipped_draft", prNumber: pull_request.number });
    return;
  }

  const allowedActions = ["opened", "reopened", "synchronize", "ready_for_review"];

  if (!allowedActions.includes(action)) {
    logger.debug({ action, msg: "pr_webhook_ignored", prNumber: pull_request.number });
    return;
  }

  logger.info({
    action,
    msg: "pr_webhook_received",
    owner: repository.owner.login,
    prNumber: pull_request.number,
    repo: repository.name,
  });

  try {
    // Find repo in DB by GitHub ID
    const repo = await prisma.repo.findFirst({
      where: { githubId: repository.id },
    });

    if (repo == null) {
      logger.warn({
        githubId: repository.id,
        msg: "pr_webhook_repo_not_found",
        owner: repository.owner.login,
        repo: repository.name,
      });
      return;
    }

    // Check if PR analysis is enabled
    const config = await PRConfigService.getConfig(repo.id, prisma);
    if (!config.enabled) {
      logger.debug({
        msg: "pr_webhook_analysis_disabled",
        prNumber: pull_request.number,
        repoId: repo.id,
      });
      return;
    }

    // Check for existing analysis
    const existingAnalysis = await prAnalysisService.getByRepoAndPRNumber(
      prisma,
      repo.id,
      pull_request.number
    );

    if (existingAnalysis != null && (action === "opened" || action === "ready_for_review")) {
      logger.warn({
        msg: "pr_webhook_analysis_already_exists",
        prNumber: pull_request.number,
        repoId: repo.id,
      });
      return;
    }

    let analysisId: number;

    if (existingAnalysis == null) {
      // Create new analysis
      const analysis = await prAnalysisService.create(prisma, {
        baseSha: pull_request.base.sha,
        headSha: pull_request.head.sha,
        owner: repository.owner.login,
        prNumber: pull_request.number,
        repoId: repo.id,
        repoName: repository.name,
      });

      analysisId = analysis.id;

      logger.info({
        analysisId: analysis.id,
        msg: "pr_webhook_analysis_created",
        prNumber: pull_request.number,
        repoId: repo.id,
      });
    } else {
      const updatedAnalysis = await prAnalysisService.update(prisma, existingAnalysis.id, {
        baseSha: pull_request.base.sha,
        headSha: pull_request.head.sha,
      });
      analysisId = updatedAnalysis.id;
    }

    // Trigger Trigger.dev task for differential analysis
    await analyzePrTask.trigger({
      analysisId,
      baseSha: pull_request.base.sha,
      headSha: pull_request.head.sha,
      owner: repository.owner.login,
      prNumber: pull_request.number,
      repoId: repo.id,
      repoName: repository.name,
    });
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      msg: "pr_webhook_error",
      owner: repository.owner.login,
      prNumber: pull_request.number,
      repo: repository.name,
    });
  }
}
