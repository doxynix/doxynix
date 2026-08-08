import crypto from "node:crypto";
import type { Octokit } from "@octokit/rest";
import type { PRCommentStyle } from "@prisma/client";
import { dedent } from "ts-dedent";

import { appLogger } from "@/server/core/app-logger";

import type { PRFinding } from "./pr-types";

/**
 * Генерирует уникальную сигнатуру для замечания, чтобы избежать дублирования комментариев.
 */
function generateFindingSignature(finding: PRFinding): string {
  const normFile = finding.file.replaceAll("\\", "/");
  const content = `${normFile}:${finding.line}:${finding.type}:${finding.title}`;
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Formats PR findings into GitHub comment bodies
 */
export const CommentFormatter = {
  formatFinding(finding: PRFinding, style: PRCommentStyle): string {
    const signature = generateFindingSignature(finding);
    const signatureTag = `\n\n<!-- doxynix-signature: ${signature} -->`;

    if (style === "CONCISE") {
      return `**${finding.type.toUpperCase()}** (${finding.severity}, score ${finding.score}/10)\n${finding.message}${signatureTag}`;
    }

    let body = `## ${finding.title}\n\n`;
    body += `**Type:** ${finding.type} | **Severity:** ${finding.severity} | **Score:** ${finding.score}/10\n\n`;
    body += `${finding.message}\n\n`;

    if (finding.suggestion != null && finding.suggestion.trim().length > 0) {
      const sanitized = this.sanitizeSuggestion(finding.suggestion);

      if (this.isProbablyNotCode(sanitized)) {
        body += `> [!TIP]\n> **AI Recommendation:**\n> ${sanitized.replaceAll("\n", "\n> ")}\n\n`;
      } else {
        body += `**AI Suggested Fix:**\n\`\`\`suggestion\n${sanitized}\n\`\`\`\n\n`;
      }
    }

    if (finding.codeSnippet != null && finding.codeSnippet.trim().length > 0) {
      const cleanSnippet = finding.codeSnippet.trim().startsWith("```")
        ? finding.codeSnippet.trim()
        : `\`\`\`\n${finding.codeSnippet}\n\`\`\``;
      body += `**Original Code:**\n${cleanSnippet}\n`;
    }

    body += signatureTag;
    return body;
  },

  isProbablyNotCode(text: string): boolean {
    const clean = text.trim();
    if (clean.length === 0) return true;

    const isSentence = /^[A-Z][\s\w',.-]+\.$/.test(clean);
    const hasNoCodeIndicators =
      !/[();={}]/g.test(clean) &&
      !/\b(const|let|var|function|import|export|if|else|return|await|async)\b/gi.test(clean);

    return isSentence && hasNoCodeIndicators;
  },

  /**
   * Очищает сгенерированное ИИ-предложение от возможных лишних маркдаун-тегов.
   */
  sanitizeSuggestion(suggestion: string): string {
    let clean = suggestion.trim();
    clean = clean.replace(/^```[a-z]*\r?\n/i, "");
    clean = clean.replace(/\r?\n```$/, "");
    return clean.trim();
  },
};

/**
 * Потокобезопасный Stateless-класс для работы с комментариями на GitHub.
 */
export class GitHubCommentPoster {
  /**
   * Post PR comments in batch (single review with all findings)
   * Фильтрует дубликаты на основе хэш-сигнатур, зашитых в существующие комментарии GitHub.
   */
  async postComments(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    commitId: string,
    findings: PRFinding[],
    style: PRCommentStyle
  ): Promise<Array<{ commentId: number; finding: PRFinding }>> {
    if (findings.length === 0) return [];

    try {
      const existingComments = await octokit.paginate(octokit.rest.pulls.listReviewComments, {
        owner,
        per_page: 100,
        pull_number: prNumber,
        repo,
      });

      const existingSignatures = new Set<string>();
      for (const comment of existingComments) {
        if (comment.body) {
          const match = /<!-- doxynix-signature: ([\da-f]+) -->/.exec(comment.body);
          if (match?.[1] != null) {
            existingSignatures.add(match[1]);
          }
        }
      }

      const newFindings = findings.filter((finding) => {
        const signature = generateFindingSignature(finding);
        return !existingSignatures.has(signature);
      });

      if (newFindings.length === 0) {
        appLogger.info({
          msg: "pr_comments_skipped_all_duplicated",
          prNumber,
          totalFindings: findings.length,
        });
        return [];
      }

      appLogger.info({
        msg: "pr_posting_new_comments",
        newCommentsCount: newFindings.length,
        prNumber,
        skippedCount: findings.length - newFindings.length,
      });

      const reviewComments = newFindings.map((finding) => ({
        body: CommentFormatter.formatFinding(finding, style),
        line: finding.line,
        path: finding.file,
        side: "RIGHT" as const,
      }));

      const review = await octokit.rest.pulls.createReview({
        comments: reviewComments,
        commit_id: commitId,
        event: "COMMENT",
        owner,
        pull_number: prNumber,
        repo,
      });

      appLogger.debug({
        commentCount: reviewComments.length,
        msg: "pr_review_posted",
        prNumber,
        reviewId: review.data.id,
      });

      return newFindings.map((finding) => ({ commentId: review.data.id, finding }));
    } catch (error) {
      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "pr_review_post_failed_falling_back_to_summary",
        prNumber,
      });
      return [];
    }
  }

  /**
   * Публикует или обновляет существующий интерактивный дашборд Doxynix в PR.
   * Предотвращает дублирование и спам в обсуждениях PR.
   */
  async postMainDashboardComment(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    findings: PRFinding[]
  ): Promise<boolean> {
    try {
      const secCount = findings.filter((f) => f.type === "SECURITY").length;
      const perfCount = findings.filter((f) => f.type === "PERFORMANCE").length;
      const compCount = findings.filter((f) => f.type === "COMPLEXITY").length;
      const styleCount = findings.filter((f) => f.type === "STYLE" || f.type === "BUG").length;

      const getBadge = (count: number, isSecurity = false) => {
        if (count === 0) return "🟢 **PASSED**";
        if (isSecurity) return "🔴 **CRITICAL**";
        return count > 2 ? "🟠 **WARNING**" : "🟡 **REVIEW**";
      };

      const getAction = (count: number, label: string) => {
        if (count === 0) return "No actions required";
        return `Review ${count} flagged ${label} issue(s) immediately`;
      };

      const repodashboard = `https://doxynix.space/dashboard/repo/${owner}/${repo}`;
      const prUrl = `https://doxynix.space/dashboard/repo/${owner}/${repo}/pull/${prNumber}`;

      const markdownBody = dedent`
        # 🔍 **Doxynix PR Analysis Dashboard**

        Hey @${owner}! Our agents have audited your changes. Here is a high-level summary of the PR impact and active quality gates.

        ## 📊 PR Quality Gates

        | Category | Status | Count | Priority Actions |
        | :--- | :---: | :---: | :--- |
        | 🛡️ **Security** | ${getBadge(secCount, true)} | \`${secCount}\` | ${getAction(secCount, "security")} |
        | ⚡ **Performance** | ${getBadge(perfCount)} | \`${perfCount}\` | ${getAction(perfCount, "performance")} |
        | 📐 **Complexity** | ${getBadge(compCount)} | \`${compCount}\` | ${getAction(compCount, "complexity")} |
        | 🎨 **Style & Bugs** | ${getBadge(styleCount)} | \`${styleCount}\` | ${getAction(styleCount, "style/bug")} |

        ---

        ## 🛠️ Interactive Actions

        | Action | Command / Link | Description |
        | :--- | :--- | :--- |
        | 🤖 **Autofix All Issues** | Type **/fix** in a comment below | Instantly generate and apply automated AI refactoring for all detected findings directly into this PR branch. |
        | 📊 **View Web Workspace** | [Open Doxynix Dashboard](${repodashboard}) | Open the Doxynix Web Workspace to view dependency hotspot maps and complexity graphs. |
        | 📈 **View Dependency Map** | [Inspect PR Map](${prUrl}) | Inspect how this PR\u0027s changes impact adjacent structural architectural zones. |

        ---
        *All code suggestions can be applied directly in the "Files changed" tab on GitHub. Powered by Doxynix.*
      `;

      const { data: comments } = await octokit.rest.issues.listComments({
        issue_number: prNumber,
        owner,
        per_page: 100,
        repo,
      });

      const existingDashboard = comments.find((c) => {
        const isBot = c.user?.type === "Bot";
        const matchesLogin = c.user?.login != null && c.user.login.startsWith("doxynix");
        const containsDashboard =
          c.body != null && c.body.includes("Doxynix PR Analysis Dashboard");
        return isBot && matchesLogin && containsDashboard;
      });

      if (existingDashboard != null) {
        await octokit.rest.issues.updateComment({
          body: markdownBody,
          comment_id: existingDashboard.id,
          owner,
          repo,
        });
        appLogger.info({
          commentId: existingDashboard.id,
          msg: "pr_main_dashboard_comment_updated",
          prNumber,
        });
      } else {
        await octokit.rest.issues.createComment({
          body: markdownBody,
          issue_number: prNumber,
          owner,
          repo,
        });
        appLogger.info({ msg: "pr_main_dashboard_comment_created", prNumber });
      }

      return true;
    } catch (error) {
      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        msg: "pr_main_dashboard_comment_failed",
        prNumber,
      });
      return false;
    }
  }

  /**
   * Update existing PR comment
   */
  async updateComment(
    octokit: Octokit,
    owner: string,
    repo: string,
    commentId: number,
    body: string
  ): Promise<boolean> {
    try {
      await octokit.rest.pulls.updateReviewComment({
        body,
        comment_id: commentId,
        owner,
        repo,
      });
      return true;
    } catch (error) {
      appLogger.error({
        commentId,
        error: error instanceof Error ? error.message : String(error),
        msg: "pr_comment_update_failed",
      });
      return false;
    }
  }
}

export const gitHubCommentPoster = new GitHubCommentPoster();
