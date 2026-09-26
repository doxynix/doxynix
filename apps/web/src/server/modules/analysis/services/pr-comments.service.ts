import { unstable_cache } from "next/cache";
import { TRPCError } from "@trpc/server";

import type { DbClient } from "@/server/core/db";
import { getInstallationClient } from "@/server/core/github/github-provider";
import { markdownToHtml } from "@/server/utils/markdown-to-html";

export const prCommentsService = {
  async getComments(db: DbClient, analysisId: string) {
    const comments = await db.pullRequestComment.findMany({
      orderBy: [{ filePath: "asc" }, { line: "asc" }],
      select: {
        analysis: {
          select: {
            repo: {
              select: {
                name: true,
                owner: true,
              },
            },
          },
        },
        body: true,
        filePath: true,
        findingType: true,
        line: true,
        publicId: true,
        riskLevel: true,
      },
      where: {
        analysis: { publicId: analysisId },
      },
    });

    const renderedComments = await Promise.all(
      comments.map(async (c) => {
        const repoContext = c.analysis.repo;

        const html = await unstable_cache(
          async () =>
            markdownToHtml({
              content: c.body,
              name: repoContext.name,
              owner: repoContext.owner,
            }),
          [`comment-html-${c.publicId}`],
          {
            revalidate: false,
            tags: ["comments", c.publicId],
          },
        )();
        return {
          bodyHtml: html,
          filePath: c.filePath,
          findingType: c.findingType,
          id: c.publicId,
          line: c.line,
          riskLevel: c.riskLevel,
        };
      }),
    );

    return {
      renderedComments,
    };
  },

  async postCommentToPR(db: DbClient, input: { body: string; prNumber: number; repoId: string }) {
    const repo = await db.repo.findUnique({
      where: { publicId: input.repoId },
    });

    if (repo == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
    }

    const installation = await db.githubInstallation.findFirst({
      where: { accountLogin: repo.owner, isSuspended: false },
    });

    if (installation == null) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "GitHub App is not installed for this repository.",
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
        repoId: repo.id,
      },
    });

    if (prAnalysis == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "PR analysis record not found for this repository and PR number",
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

    return { commentId: localComment.id, success: true };
  },
};
