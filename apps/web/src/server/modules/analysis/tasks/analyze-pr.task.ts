import type { Octokit } from "@octokit/rest";
import { task } from "@trigger.dev/sdk";
import * as z from "zod";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { getClientContext } from "@/server/core/github/github-provider";
import { prAnalysisLogger } from "@/server/utils/pr-analysis-logger";
import { TASK_CONFIGS } from "@/server/utils/task-config";

import { analysisRepo } from "../analysis.repository";
import { persistedFindingSchema } from "../analysis.schemas";
import { CommentFormatter, gitHubCommentPoster } from "../logic/comment-poster";
import { DifferentialAnalyzer } from "../logic/differential-analyzer";
import { healAndPartitionFindings } from "../logic/patch-healer";
import { mergePrBody } from "../logic/pr-body";
import { PRConfigService } from "../logic/pr-config";
import { taskLogger } from "../logic/task-logger";

async function updateCommitStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  state: "error" | "failure" | "pending" | "success",
  description: string,
  prNumber: number,
) {
  try {
    const targetUrl = `https://doxynix.space/dashboard/repo/${owner}/${repo}/pull/${prNumber}`;

    await octokit.rest.repos.createCommitStatus({
      context: "Doxynix / PR Analysis",
      description: description.slice(0, 140),
      owner,
      repo,
      sha,
      state,
      target_url: targetUrl,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    taskLogger.error(`Failed to update GitHub commit status: ${errorMsg}`);
    appLogger.warn({ error, msg: "Failed to update GitHub commit status" });
  }
}

export const analyzePrTask = task({
  id: "analyze-pr",
  ...TASK_CONFIGS.analyzePr,
  run: async (payload: {
    analysisId: number;
    baseSha: string;
    headSha: string;
    owner: string;
    prNumber: number;
    repoId: number;
    repoName: string;
  }) => {
    let octokitInstance: null | Octokit = null;

    try {
      const startTime = Date.now();

      const repo = await prisma.repo.findUnique({
        select: { publicId: true, userId: true },
        where: { id: payload.repoId },
      });

      if (repo == null) {
        throw new Error(`Repo with ID ${payload.repoId} not found`);
      }

      const { octokit } = await getClientContext(prisma, repo.userId, payload.owner);
      octokitInstance = octokit;

      await updateCommitStatus(
        octokit,
        payload.owner,
        payload.repoName,
        payload.headSha,
        "pending",
        "Doxynix is analyzing your changes...",
        payload.prNumber,
      );

      const lastFullAnalysis = await prisma.analysis.findFirst({
        orderBy: { createdAt: "desc" },
        select: { resultJson: true },
        where: {
          repoId: payload.repoId,
          status: "DONE",
        },
      });

      const projectOverviewJson =
        lastFullAnalysis?.resultJson != null ? JSON.stringify(lastFullAnalysis.resultJson) : "{}";

      const config = await PRConfigService.getConfig(repo.publicId, prisma);

      await analysisRepo.updatePRAnalysisStatus(prisma, payload.analysisId, "ANALYZING");

      prAnalysisLogger.analyzeStarted(payload.repoId, payload.prNumber, config.tokenBudget);

      const ghFiles = await octokit.paginate(octokit.rest.pulls.listFiles, {
        owner: payload.owner,
        per_page: 100,
        pull_number: payload.prNumber,
        repo: payload.repoName,
      });

      const changedFiles = ghFiles.map((f) => ({
        additions: f.additions,
        deletions: f.deletions,
        filename: f.filename,
        patch: f.patch,
        previousFilename: f.previous_filename ?? null,
        status:
          f.status === "added" ||
          f.status === "modified" ||
          f.status === "removed" ||
          f.status === "renamed"
            ? f.status
            : "modified",
      }));

      await analysisRepo.storeChangedFilesSnapshot(
        prisma,
        payload.analysisId,
        changedFiles.map((file) => ({
          additions: file.additions,
          deletions: file.deletions,
          filePath: file.filename,
          previousFilePath: file.previousFilename,
          status: file.status,
        })),
      );

      const analyzer = new DifferentialAnalyzer(config);
      const result = await analyzer.analyzePRDiff(
        {
          baseSha: payload.baseSha,
          changedFiles,
          headSha: payload.headSha,
          owner: payload.owner,
          prNumber: payload.prNumber,
          repoName: payload.repoName,
        },
        projectOverviewJson,
        {
          branch: payload.headSha,
          repoId: repo.publicId,
          userId: Number(repo.userId),
        },
      );

      const { commentable: validatedInlineFindings, findings: healedFindings } =
        healAndPartitionFindings({ changedFiles, findings: result.findings });

      if (result.summary && result.summary.trim().length > 0) {
        try {
          await gitHubCommentPoster.postMainDashboardComment(
            octokit,
            payload.owner,
            payload.repoName,
            payload.prNumber,
            healedFindings,
          );
          const { data: prData } = await octokit.rest.pulls.get({
            owner: payload.owner,
            pull_number: payload.prNumber,
            repo: payload.repoName,
          });

          const mergedBody = mergePrBody(prData.body, result.summary);

          await octokit.rest.pulls.update({
            body: mergedBody,
            owner: payload.owner,
            pull_number: payload.prNumber,
            repo: payload.repoName,
          });
          appLogger.info({
            msg: "PR description successfully updated with AI summary",
            prNumber: payload.prNumber,
          });
        } catch (updateError) {
          const errorMsg = updateError instanceof Error ? updateError.message : String(updateError);
          taskLogger.error(`Failed to update PR description or post dashboard: ${errorMsg}`);
          appLogger.warn({ error: updateError, msg: "Failed to update GitHub PR description" });
        }
      }

      const finalFindings = [...healedFindings];

      if (finalFindings.length === 0) {
        finalFindings.push({
          file: changedFiles[0]?.filename ?? "README.md",
          line: 1,
          message:
            "✅ **Doxynix Analysis Summary**:\n\nReview complete. No critical vulnerabilities, architecture violations, or performance issues were found in the provided diff. The code complies with the project's established policies.",
          score: 0,
          severity: "LOW",
          suggestion: "The changes look safe. You can proceed with the review.",
          title: "Analysis Completed",
          type: "STYLE",
        });
      }

      if (config.commentStyle !== "OFF") {
        const postedComments = await gitHubCommentPoster.postComments(
          octokit,
          payload.owner,
          payload.repoName,
          payload.prNumber,
          payload.headSha,
          validatedInlineFindings,
          config.commentStyle,
        );

        prAnalysisLogger.commentsPosted(payload.repoId, payload.prNumber, postedComments.length);

        if (postedComments.length > 0) {
          const dbComments = postedComments.map((c) => ({
            body: CommentFormatter.formatFinding(c.finding, config.commentStyle),
            filePath: c.finding.file,
            findingType: c.finding.type,
            line: c.finding.line,
            riskLevel: c.finding.score,
          }));
          await analysisRepo.addComments(prisma, payload.analysisId, dbComments);
        }
      }

      const duration = Date.now() - startTime;
      const candidate = finalFindings.map((f) => ({
        file: f.file,
        line: f.line,
        message: f.message,
        score: f.score,
        title: f.title,
        type: f.type,
      }));

      const validated = z.array(persistedFindingSchema).safeParse(candidate);
      if (!validated.success) {
        appLogger.warn({
          analysisId: payload.analysisId,
          error: z.treeifyError(validated.error),
          msg: "pr_findings_validation_failed",
        });
      }

      await analysisRepo.updatePRAnalysisStatus(prisma, payload.analysisId, "COMPLETED", {
        findingsJson: validated.success ? validated.data : candidate,
        riskScore: result.riskScore,
      });

      await updateCommitStatus(
        octokit,
        payload.owner,
        payload.repoName,
        payload.headSha,
        "success",
        `Doxynix Analysis completed. ${healedFindings.length} findings identified.`,
        payload.prNumber,
      );

      prAnalysisLogger.analyzeCompleted(
        payload.repoId,
        payload.prNumber,
        duration,
        healedFindings.length,
      );

      return {
        analysisId: payload.analysisId,
        duration,
        findings: healedFindings.length,
        riskScore: result.riskScore,
        success: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      taskLogger.error(`CRITICAL Task Execution Failed: ${errorMsg}`);

      if (octokitInstance != null) {
        await updateCommitStatus(
          octokitInstance,
          payload.owner,
          payload.repoName,
          payload.headSha,
          "failure",
          `Doxynix Analysis failed: ${errorMsg}`,
          payload.prNumber,
        );
      }

      await analysisRepo.updatePRAnalysisStatus(prisma, payload.analysisId, "FAILED", {
        error: errorMsg,
      });

      prAnalysisLogger.analyzeFailed(payload.repoId, payload.prNumber, errorMsg);

      throw error;
    }
  },
});
