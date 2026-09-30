import { prisma } from "@/server/core/db";
import type { PullRequestReviewCommentPayload } from "@/server/core/github/github-webhook.types";
import type { GithubMentionReply } from "@/server/domain/github-mention-reply";

export async function handleReviewCommentEvent(
  payload: PullRequestReviewCommentPayload,
): Promise<GithubMentionReply | null> {
  if (
    payload.action !== "created" ||
    (payload.sender.type === "Bot" && payload.sender.login === "doxynix[bot]")
  ) {
    return null;
  }

  const commentBody = payload.comment.body;
  if (!commentBody.includes("@doxynix")) {
    return null;
  }

  const repo = await prisma.repo.findFirst({
    where: { githubId: payload.repository.id },
  });

  if (repo == null) {
    return null;
  }

  return {
    branch: repo.defaultBranch,
    commentBody,
    commentId: payload.comment.id,
    commentType: "review",
    owner: payload.repository.owner.login,
    prNumber: payload.pull_request.number,
    repoId: repo.id,
    repoName: payload.repository.name,
    userId: repo.userId,
  };
}
