import type { Octokit } from "@octokit/rest";

import { logger } from "@/server/shared/infrastructure/logger";

import type { PRFinding } from "../model/pr-types";

export type GitHubCommentInput = {
  commitId: string;
  filePath: string;
  finding: PRFinding;
  line: number;
  owner: string;
  prNumber: number;
  repo: string;
};

/**
 * Formats PR findings into GitHub comment bodies
 */
export class CommentFormatter {
  static formatFinding(finding: PRFinding, style: "concise" | "detailed"): string {
    if (style === "concise") {
      return `**${finding.type.toUpperCase()}** (Risk: ${finding.severity}/10)\n${finding.message}`;
    }

    let body = `## ${finding.title}\n\n`;
    body += `**Type:** ${finding.type} | **Severity:** ${finding.severity}/10\n\n`;
    body += `${finding.message}\n\n`;

    if (finding.suggestion != null) {
      body += `**Suggestion:**\n\`\`\`\n${finding.suggestion}\n\`\`\`\n\n`;
    }

    if (finding.codeSnippet != null) {
      body += `**Code:**\n\`\`\`\n${finding.codeSnippet}\n\`\`\`\n`;
    }

    return body;
  }
}

/**
 * Posts findings as GitHub comments via Octokit
 */
export class GitHubCommentPoster {
  constructor(private octokit: Octokit) {}

  /**
   * Post PR comments in batch (single review with all findings)
   */
  async postComments(
    owner: string,
    repo: string,
    prNumber: number,
    commitId: string,
    findings: PRFinding[],
    style: "concise" | "detailed" = "detailed"
  ): Promise<Array<{ commentId: number; finding: PRFinding }>> {
    if (findings.length === 0) return [];

    const reviewComments = findings.map((finding) => ({
      body: CommentFormatter.formatFinding(finding, style),
      line: finding.line,
      path: finding.file,
    }));

    try {
      const review = await this.octokit.rest.pulls.createReview({
        comments: reviewComments,
        commit_id: commitId,
        event: "COMMENT",
        owner,
        pull_number: prNumber,
        repo,
      });

      logger.debug({
        commentCount: reviewComments.length,
        msg: "pr_review_posted",
        prNumber,
        reviewId: review.data.id,
      });

      return findings.map((finding) => ({ commentId: review.data.id, finding }));
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "pr_review_post_failed",
        prNumber,
      });
      return [];
    }
  }

  /**
   * Update existing PR comment
   */
  async updateComment(
    owner: string,
    repo: string,
    commentId: number,
    body: string
  ): Promise<boolean> {
    try {
      await this.octokit.rest.pulls.updateReviewComment({
        body,
        comment_id: commentId,
        owner,
        repo,
      });
      return true;
    } catch (error) {
      logger.error({
        commentId,
        error: error instanceof Error ? error.message : String(error),
        msg: "pr_comment_update_failed",
      });
      return false;
    }
  }
}
