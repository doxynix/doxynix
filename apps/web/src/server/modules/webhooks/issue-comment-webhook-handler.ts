import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { normalizeError } from "@/server/core/api-error";
import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import type { IssueCommentCreatedPayload } from "@/server/core/github/github-webhook.types";
import { realtimeService } from "@/server/core/realtime";
import type { GithubMentionReply } from "@/server/domain/github-mention-reply";

export async function handleIssueCommentEvent(
  payload: IssueCommentCreatedPayload,
): Promise<GithubMentionReply | null> {
  if (payload.sender.type === "Bot" && payload.sender.login === "doxynix[bot]") {
    return null;
  }

  const repos = await prisma.repo.findMany({
    where: { githubId: payload.repository.id },
  });

  if (repos.length === 0) {
    return null;
  }

  const repoById = new Map(repos.map((repo) => [repo.id, repo]));

  const prAnalyses = await prisma.pullRequestAnalysis.findMany({
    select: { id: true, repoId: true },
    where: {
      prNumber: payload.issue.number,
      repoId: { in: repos.map((repo) => repo.id) },
    },
  });

  if (prAnalyses.length === 0) {
    appLogger.warn({
      msg: "Skipping GitHub comment sync: PullRequestAnalysis record not found in DB",
      prNumber: payload.issue.number,
      repoIds: repos.map((repo) => repo.id),
    });
    return null;
  }

  const commentBody = payload.comment.body;

  let prComments: { analysisId: string; id: string }[];
  try {
    prComments = await prisma.pullRequestComment.createManyAndReturn({
      data: prAnalyses.map((analysis) => ({
        analysisId: analysis.id,
        body: commentBody,
        filePath: "PR_DISCUSSION",
        findingType: "GITHUB_USER_COMMENT",
        githubCommentId: payload.comment.id,
        line: 0,
        riskLevel: 0,
      })),
      select: { analysisId: true, id: true },
    });
  } catch (error) {
    if (normalizeError(error).code !== "CONFLICT") {
      throw error;
    }

    appLogger.info({
      commentId: payload.comment.id,
      msg: "Skipping GitHub comment sync: already mirrored by an earlier delivery",
      prNumber: payload.issue.number,
    });
    return null;
  }

  const repoIdByAnalysis = new Map(prAnalyses.map((analysis) => [analysis.id, analysis.repoId]));
  const mentions = commentBody.includes("@doxynix");
  let mentionReply: GithubMentionReply | null = null;

  await Promise.all(
    prComments.map(async (prComment) => {
      const repo = repoById.get(repoIdByAnalysis.get(prComment.analysisId) ?? "");
      if (repo == null) {
        return;
      }

      await realtimeService
        .user(repo.createdByUserId)
        .publish(REALTIME_CONFIG.events.user.prCommentReceived, {
          author: payload.sender.login,
          authorAvatarUrl: payload.sender.avatar_url,
          commentId: prComment.id,
          prNumber: payload.issue.number,
          prTitle: payload.issue.title,
          repoName: payload.repository.name,
          repoOwner: payload.repository.owner.login,
        });

      if (mentionReply == null && mentions) {
        mentionReply = {
          branch: repo.defaultBranch,
          commentBody,
          commentId: payload.comment.id,
          commentType: "issue",
          owner: payload.repository.owner.login,
          prNumber: payload.issue.number,
          repoId: repo.id,
          repoName: payload.repository.name,
          userId: repo.createdByUserId,
        };
      }
    }),
  );

  return mentionReply;
}
