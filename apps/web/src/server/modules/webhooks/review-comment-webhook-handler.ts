import { prisma } from "@/server/core/db";
import type { PullRequestReviewCommentPayload } from "@/server/core/github/github-webhook.types";
import type { GithubMentionReply } from "@/server/domain/github-mention-reply";

export async function handleReviewCommentEvent(
  payload: PullRequestReviewCommentPayload,
): Promise<GithubMentionReply[]> {
  if (
    payload.action !== "created" ||
    (payload.sender.type === "Bot" && payload.sender.login === "doxynix[bot]")
  ) {
    return [];
  }

  const commentBody = payload.comment.body;
  if (!commentBody.includes("@doxynix")) {
    return [];
  }

  const repos = await prisma.repo.findMany({
    where: { githubId: payload.repository.id },
  });

  return repos.map((repo) => ({
    branch: repo.defaultBranch,
    commentBody,
    commentId: payload.comment.id,
    commentType: "review",
    owner: payload.repository.owner.login,
    prNumber: payload.pull_request.number,
    repoId: repo.id,
    repoName: payload.repository.name,
    userId: repo.createdByUserId,
  }));
}
