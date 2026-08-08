import { task } from "@trigger.dev/sdk";
import { dedent } from "ts-dedent";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { getInstallationClient } from "@/server/core/github/github-provider";
import { callWithFallback } from "@/server/utils/call";
import { buildRequestStore, requestContext } from "@/server/utils/request-context";
import { TASK_CONFIGS } from "@/server/utils/task-config";

import { getActiveModels } from "../../analysis/ai/ai-constants";
import { buildRepositoryToolProfile } from "../../analysis/ai/ai-tools";
import { GITHUB_AGENT_SYSTEM_PROMPT } from "../agent.prompts";

type GithubReplyPayload = {
  branch: string;
  commentBody: string;
  commentId: number;
  commentType: "issue" | "review";
  owner: string;
  prNumber: number;
  repoId: string;
  repoName: string;
  userId: number;
};

export const agentGithubReplyTask = task({
  id: "agent-github-reply",
  ...TASK_CONFIGS.agentGithubReply,
  run: async (payload: GithubReplyPayload) => {
    appLogger.info({
      commentId: payload.commentId,
      msg: "github_agent_reply_task_started",
      prNumber: payload.prNumber,
      repo: `${payload.owner}/${payload.repoName}`,
    });

    const activeModels = await getActiveModels();

    const installation = await prisma.githubInstallation.findFirst({
      where: { accountLogin: payload.owner, isSuspended: false },
    });

    if (installation == null) {
      throw new Error(`GitHub App installation not found or suspended for owner: ${payload.owner}`);
    }

    const botOctokit = getInstallationClient(Number(installation.id));

    let reactionId: number | undefined;

    try {
      if (payload.commentType === "issue") {
        const { data: reaction } = await botOctokit.rest.reactions.createForIssueComment({
          comment_id: payload.commentId,
          content: "eyes",
          owner: payload.owner,
          repo: payload.repoName,
        });
        reactionId = reaction.id;
      } else {
        const { data: reaction } =
          await botOctokit.rest.reactions.createForPullRequestReviewComment({
            comment_id: payload.commentId,
            content: "eyes",
            owner: payload.owner,
            repo: payload.repoName,
          });
        reactionId = reaction.id;
      }
    } catch (error) {
      appLogger.warn({ error, msg: "Failed to add initial 'eyes' reaction to comment" });
    }

    let filePathContext: string | undefined;
    let lineContext: number | undefined;
    let diffHunkContext: string | undefined;
    let threadContext = "";

    try {
      if (payload.commentType === "review") {
        const { data: targetComment } = await botOctokit.rest.pulls.getReviewComment({
          comment_id: payload.commentId,
          owner: payload.owner,
          repo: payload.repoName,
        });

        filePathContext = targetComment.path;
        lineContext = targetComment.line ?? undefined;
        diffHunkContext = targetComment.diff_hunk;

        const { data: allPrComments } = await botOctokit.rest.pulls.listReviewComments({
          owner: payload.owner,
          pull_number: payload.prNumber,
          repo: payload.repoName,
        });

        const threadRootId = targetComment.in_reply_to_id ?? targetComment.id;

        const threadComments = allPrComments
          .filter((c) => c.id === threadRootId || c.in_reply_to_id === threadRootId)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        threadContext = threadComments.map((c) => `${c.user.login}: "${c.body}"`).join("\n");
      } else {
        const { data: issueComments } = await botOctokit.rest.issues.listComments({
          issue_number: payload.prNumber,
          owner: payload.owner,
          per_page: 30,
          repo: payload.repoName,
        });

        threadContext = issueComments
          .map((c) => `${c.user?.login ?? "unknown"}: "${c.body}"`)
          .join("\n");
      }
    } catch (error) {
      appLogger.error({ err: error, msg: "Failed to assemble rich GitHub conversation context" });
    }

    const store = buildRequestStore({
      method: "task",
      path: "/task/agent-github-reply",
      req: { headers: new Headers() } as any,
      requestId: `reply-${payload.commentId}`,
      userId: payload.userId,
    });

    return requestContext.run(store, async () => {
      const prompt = dedent`
        An authenticated user has mentioned you in a GitHub Pull Request comment thread.
        PR Number: ${payload.prNumber}

        ${filePathContext != null ? `[SPATIAL CONTEXT]\nTarget File: [[${filePathContext}]]\nTarget Line: ${lineContext ?? "unknown"}` : ""}
        ${diffHunkContext != null ? `Target Code Diff Hunk:\n\`\`\`diff\n${diffHunkContext}\n\`\`\`` : ""}

        ${threadContext ? `\n[CONVERSATION HISTORY OF THIS THREAD]:\n${threadContext}` : ""}

        User's Latest Comment: "${payload.commentBody.replace("@Doxynix", "").trim()}"

        Analyze their request and the provided conversation history.
        Use your tools (like searchCode or readFile) to investigate the repository if needed.
        Write a high-density, professional technical response in Markdown.
        Always preserve a helpful, objective, and action-oriented tone.
      `;

      const result = await callWithFallback<unknown>({
        attemptMetadata: { operation: "agent-github-reply" },
        models: activeModels.AGENT,
        outputSchema: null,
        prompt,
        stepCount: 10,
        stream: false,
        system: GITHUB_AGENT_SYSTEM_PROMPT,
        taskType: "creative",
        tools: buildRepositoryToolProfile(
          "github_agent",
          payload.userId,
          payload.repoId,
          payload.branch
        ),
      });

      if (payload.commentType === "review") {
        await botOctokit.rest.pulls.createReplyForReviewComment({
          body: `> **@Doxynix**\n\n${result}`,
          comment_id: payload.commentId,
          owner: payload.owner,
          pull_number: payload.prNumber,
          repo: payload.repoName,
        });
      } else {
        await botOctokit.rest.issues.createComment({
          body: `> **@Doxynix**\n\n${result}`,
          issue_number: payload.prNumber,
          owner: payload.owner,
          repo: payload.repoName,
        });
      }

      if (reactionId != null) {
        try {
          if (payload.commentType === "issue") {
            await botOctokit.rest.reactions.deleteForIssueComment({
              comment_id: payload.commentId,
              owner: payload.owner,
              reaction_id: reactionId,
              repo: payload.repoName,
            });
          } else {
            await botOctokit.rest.reactions.deleteForPullRequestComment({
              comment_id: payload.commentId,
              owner: payload.owner,
              reaction_id: reactionId,
              repo: payload.repoName,
            });
          }
        } catch (error) {
          appLogger.warn({ error, msg: "Failed to delete initial 'eyes' reaction from comment" });
        }
      }

      try {
        if (payload.commentType === "issue") {
          await botOctokit.rest.reactions.createForIssueComment({
            comment_id: payload.commentId,
            content: "rocket",
            owner: payload.owner,
            repo: payload.repoName,
          });
        } else {
          await botOctokit.rest.reactions.createForPullRequestReviewComment({
            comment_id: payload.commentId,
            content: "rocket",
            owner: payload.owner,
            repo: payload.repoName,
          });
        }
      } catch (error) {
        appLogger.warn({ error, msg: "Failed to add final 'rocket' reaction to comment" });
      }

      return { success: true };
    });
  },
});
