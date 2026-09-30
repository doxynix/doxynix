/** A `@doxynix` mention resolved to a repo; the agent task consumes it as-is. */
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
