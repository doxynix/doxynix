import { revalidateTag, unstable_cache } from "next/cache";
import { MessageCode } from "@doxynix/shared";
import * as z from "zod";

import { commentsToFindings } from "@/shared/lib/comment-to-finding";

import { AppError } from "@/server/core/api-error";
import { appLogger } from "@/server/core/app-logger";
import type { DbClient } from "@/server/core/db";
import { getInstallationClient } from "@/server/core/github/github-client";
import { fixesService } from "@/server/modules/analysis/services/fixes.service";
import { markdownToHtml } from "@/server/modules/analysis/services/markdown-to-html";
import { keysetArgs, splitKeysetPage } from "@/server/utils/pagination";
import { requestContext } from "@/server/utils/request-context";

// A bulk fix reads the whole analysis, so the cap is a safety valve rather than a page: an
// analysis near it is logged instead of silently truncated.
export const MAX_FIXABLE_COMMENTS = 5000;

export const prCommentsService = {
  // The verdict must cover the analysis, not the pages the caller happened to scroll through, so
  // the fix is built from every stored comment in one server-side read.
  async fixAllComments(db: DbClient, userId: string, prAnalysisId: string, workspaceId: string) {
    const analysis = await db.pullRequestAnalysis.findFirst({
      select: { repo: { select: { id: true } } },
      where: { id: prAnalysisId, repo: { workspaceId } },
    });

    if (analysis == null) {
      throw new AppError({
        code: "NOT_FOUND",
        messageCode: MessageCode.ANALYSIS_NOT_FOUND,
        publicMessage: "Analysis not found",
      });
    }

    const comments = await db.pullRequestComment.findMany({
      orderBy: [{ filePath: "asc" }, { line: "asc" }, { id: "asc" }],
      select: { body: true, filePath: true, findingType: true, line: true },
      take: MAX_FIXABLE_COMMENTS,
      where: { analysis: { id: prAnalysisId, repo: { workspaceId } } },
    });

    if (comments.length === MAX_FIXABLE_COMMENTS) {
      appLogger.warn({
        cap: MAX_FIXABLE_COMMENTS,
        msg: "pr_comment_fix_cap_hit",
        prAnalysisId,
      });
    }

    if (comments.length === 0) {
      return { error: "No comments to fix", success: false };
    }

    return fixesService.createFix(
      db,
      userId,
      {
        fileContents: {},
        findings: commentsToFindings(
          comments.map((comment) => ({
            filePath: comment.filePath,
            findingType: comment.findingType,
            line: comment.line,
            suggestion: comment.body,
          })),
        ),
        prAnalysisId,
        repoId: analysis.repo.id,
      },
      workspaceId,
    );
  },
  async getComments(
    db: DbClient,
    analysisId: string,
    workspaceId: string,
    input: { cursor?: null | string; limit: number },
  ) {
    const where = { analysis: { id: analysisId, repo: { workspaceId } } };

    const [rows, total] = await Promise.all([
      db.pullRequestComment.findMany({
        ...keysetArgs(input.cursor, input.limit),
        orderBy: [{ filePath: "asc" }, { line: "asc" }, { id: "asc" }],
        select: {
          analysis: {
            select: {
              repo: {
                select: {
                  name: true,
                  owner: true,
                },
              },
              updatedAt: true,
            },
          },
          body: true,
          filePath: true,
          findingType: true,
          id: true,
          line: true,
          riskLevel: true,
        },
        where,
      }),
      // Only the first page renders the total, so a later page must not pay for a COUNT(*).
      input.cursor == null ? db.pullRequestComment.count({ where }) : null,
    ]);

    const { hasNextPage, items: comments, nextCursor } = splitKeysetPage(rows, input.limit);
    const meta = { hasNextPage, nextCursor };

    // An empty page must not create a cache entry for an arbitrary analysis id
    const firstComment = comments[0];
    if (firstComment == null) {
      return { meta, renderedComments: [], total };
    }

    // Content-addressed by analysis version and page position: a re-analysis bumps `updatedAt`,
    // while the cursor and limit separate the pages of one version.
    const cacheVersion = [
      firstComment.analysis.updatedAt.getTime(),
      input.cursor ?? "start",
      input.limit,
    ].join("-");

    const renderedComments = await unstable_cache(
      async () =>
        Promise.all(
          comments.map(async (c) => {
            const repoContext = c.analysis.repo;

            const html = await markdownToHtml({
              content: c.body,
              name: repoContext.name,
              owner: repoContext.owner,
            });

            return {
              bodyHtml: html,
              filePath: c.filePath,
              findingType: c.findingType,
              id: c.id,
              line: c.line,
              riskLevel: c.riskLevel,
            };
          }),
        ),
      [`pr-comments-html-${workspaceId}-${analysisId}-${cacheVersion}`],
      {
        revalidate: 3600,
        tags: ["comments", analysisId, workspaceId],
      },
    )();

    return {
      meta,
      renderedComments,
      total,
    };
  },

  async postCommentToPR(
    db: DbClient,
    input: { body: string; prNumber: number; repoId: string },
    workspaceId: string,
  ) {
    const repo = await db.repo.findUnique({
      where: { id: input.repoId, workspaceId },
    });

    if (repo == null) {
      throw new AppError({
        code: "NOT_FOUND",
        messageCode: MessageCode.REPO_NOT_FOUND,
        publicMessage: "Repository not found",
      });
    }

    const installation = await db.githubInstallation.findFirst({
      where: { accountLogin: repo.owner, isSuspended: false, workspaceId },
    });

    if (installation == null) {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        messageCode: MessageCode.GITHUB_APP_NOT_INSTALLED,
        publicMessage: "GitHub App is not installed for this repository.",
      });
    }

    const botOctokit = getInstallationClient(Number(installation.id));

    await botOctokit.rest.issues.createComment({
      body: input.body,
      issue_number: input.prNumber,
      owner: repo.owner,
      repo: repo.name,
    });

    const prAnalysis = await db.pullRequestAnalysis.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
      where: {
        prNumber: input.prNumber,
        repo: { id: repo.id, workspaceId },
      },
    });

    if (prAnalysis == null) {
      throw new AppError({
        code: "NOT_FOUND",
        messageCode: MessageCode.PR_ANALYSIS_NOT_FOUND,
        publicMessage: "PR analysis record not found for this repository and PR number",
      });
    }

    const localComment = await db.pullRequestComment.create({
      data: {
        analysis: {
          connect: { id: prAnalysis.id },
        },
        body: input.body,
        filePath: "PR_DISCUSSION",
        findingType: "USER_COMMENT",
        line: 0,
        riskLevel: 0,
      },
    });

    // Outside a request scope Next has no static generation store and throws
    if (requestContext.getStore() != null) {
      revalidateTag(prAnalysis.id, { expire: 0 });
    }

    return { commentId: localComment.id, success: true };
  },
};

export const PostCommentToPROutput = z.object({
  commentId: z.uuid(),
  success: z.boolean(),
});

export type PostCommentToPROutput = z.infer<typeof PostCommentToPROutput>;
