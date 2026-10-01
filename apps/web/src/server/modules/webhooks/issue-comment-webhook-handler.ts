import { REALTIME_CONFIG } from "@/shared/config/realtime";

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

  const repo = await prisma.repo.findFirst({
    where: { githubId: payload.repository.id },
  });

  if (repo == null) {
    return null;
  }

  const prAnalysis = await prisma.pullRequestAnalysis.findFirst({
    select: { id: true },
    where: {
      prNumber: payload.issue.number,
      repoId: repo.id,
    },
  });

  if (prAnalysis == null) {
    appLogger.warn({
      msg: "Skipping GitHub comment sync: PullRequestAnalysis record not found in DB",
      prNumber: payload.issue.number,
      repoId: repo.id,
    });
    return null;
  }

  const commentBody = payload.comment.body;

  const prComment = await prisma.pullRequestComment.create({
    data: {
      analysis: {
        connect: { id: prAnalysis.id },
      },
      body: commentBody,
      filePath: "PR_DISCUSSION",
      findingType: "GITHUB_USER_COMMENT",
      line: 0,
      riskLevel: 0,
    },
  });

  await realtimeService.user(repo.userId).publish(REALTIME_CONFIG.events.user.prCommentReceived, {
    author: payload.sender.login,
    authorAvatarUrl: payload.sender.avatar_url,
    commentId: prComment.id,
    prNumber: payload.issue.number,
    prTitle: payload.issue.title,
    repoName: payload.repository.name,
    repoOwner: payload.repository.owner.login,
  });

  if (!commentBody.includes("@doxynix")) {
    return null;
  }

  return {
    branch: repo.defaultBranch,
    commentBody,
    commentId: payload.comment.id,
    commentType: "issue",
    owner: payload.repository.owner.login,
    prNumber: payload.issue.number,
    repoId: repo.id,
    repoName: payload.repository.name,
    userId: repo.userId,
  };
}
