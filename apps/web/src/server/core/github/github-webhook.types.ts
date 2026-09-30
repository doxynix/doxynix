import type { EmitterWebhookEvent, EmitterWebhookEventName } from "@octokit/webhooks";

type PayloadOf<TEvent extends EmitterWebhookEventName> = EmitterWebhookEvent<TEvent>["payload"];

export type InstallationPayload = PayloadOf<"installation">;

export type IssueCommentCreatedPayload = EmitterWebhookEvent<"issue_comment.created">["payload"];

export type GithubMentionReply = {
  branch: string;
  commentBody: string;
  commentId: number;
  commentType: "issue" | "review";
  owner: string;
  prNumber: number;
  repoId: string;
  repoName: string;
  userId: string;
};

export type PullRequestPayload = PayloadOf<"pull_request">;

export type PullRequestReviewCommentPayload = PayloadOf<"pull_request_review_comment">;

export type PushPayload = PayloadOf<"push">;

export type RepositoryPayload = PayloadOf<"repository">;

export type WebhookRepository = RepositoryPayload["repository"];
