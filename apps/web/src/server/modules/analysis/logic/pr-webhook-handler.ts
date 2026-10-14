import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import type { PullRequestPayload } from "@/server/core/github/github-webhook.types";
import { PRConfigService } from "@/server/modules/analysis/logic/pr-config";

import { analysisRepo } from "../analysis.repository";
import { analyzePrTask } from "../tasks/analyze-pr.task";

async function analyzeRepoForEvent(
  repoId: string,
  action: string,
  pullRequest: PullRequestPayload["pull_request"],
  repository: PullRequestPayload["repository"],
): Promise<void> {
  const config = await PRConfigService.getConfig(repoId, prisma);
  if (!config.enabled) {
    appLogger.debug({
      msg: "pr_webhook_analysis_disabled",
      prNumber: pullRequest.number,
      repoId,
    });
    return;
  }

  const existingAnalysis = await analysisRepo.getByRepoAndPRNumber(
    prisma,
    repoId,
    pullRequest.number,
  );

  if (existingAnalysis != null && (action === "opened" || action === "ready_for_review")) {
    appLogger.warn({
      msg: "pr_webhook_analysis_already_exists",
      prNumber: pullRequest.number,
      repoId,
    });
    return;
  }

  let prAnalysisId: string;

  if (existingAnalysis == null) {
    const analysis = await analysisRepo.createPRAnalysis(prisma, {
      baseSha: pullRequest.base.sha,
      headSha: pullRequest.head.sha,
      owner: repository.owner.login,
      prNumber: pullRequest.number,
      repoId,
      repoName: repository.name,
    });

    prAnalysisId = analysis.id;

    appLogger.info({
      analysisId: analysis.id,
      msg: "pr_webhook_analysis_created",
      prNumber: pullRequest.number,
      repoId,
    });
  } else {
    const updatedAnalysis = await analysisRepo.updatePRAnalysis(prisma, existingAnalysis.id, {
      baseSha: pullRequest.base.sha,
      headSha: pullRequest.head.sha,
    });
    prAnalysisId = updatedAnalysis.id;
  }

  await analyzePrTask.trigger({
    baseSha: pullRequest.base.sha,
    headSha: pullRequest.head.sha,
    owner: repository.owner.login,
    prAnalysisId,
    prNumber: pullRequest.number,
    repoId,
    repoName: repository.name,
  });
}

export async function handlePullRequestEvent(payload: PullRequestPayload): Promise<void> {
  const { action, pull_request, repository } = payload;

  if (pull_request.user?.type === "Bot") {
    appLogger.debug({
      bot: pull_request.user.login,
      msg: "pr_webhook_ignored_bot",
      prNumber: pull_request.number,
    });
    return;
  }

  if (pull_request.draft) {
    appLogger.debug({ msg: "pr_webhook_skipped_draft", prNumber: pull_request.number });
    return;
  }

  const allowedActions = ["opened", "reopened", "synchronize", "ready_for_review"];

  if (!allowedActions.includes(action)) {
    appLogger.debug({ action, msg: "pr_webhook_ignored", prNumber: pull_request.number });
    return;
  }

  appLogger.info({
    action,
    msg: "pr_webhook_received",
    owner: repository.owner.login,
    prNumber: pull_request.number,
    repo: repository.name,
  });

  const repos = await prisma.repo.findMany({
    select: { id: true },
    where: { githubId: repository.id },
  });

  if (repos.length === 0) {
    appLogger.warn({
      githubId: repository.id,
      msg: "pr_webhook_repo_not_found",
      owner: repository.owner.login,
      repo: repository.name,
    });
    return;
  }

  const settled = await Promise.allSettled(
    repos.map((repo) => analyzeRepoForEvent(repo.id, action, pull_request, repository)),
  );

  settled.forEach((outcome, index) => {
    if (outcome.status === "rejected") {
      appLogger.error({
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        msg: "pr_webhook_error",
        owner: repository.owner.login,
        prNumber: pull_request.number,
        repo: repository.name,
        repoId: repos[index]?.id,
      });
    }
  });
}
