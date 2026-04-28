import type { PRAnalysisStatus } from "@prisma/client";
import { task } from "@trigger.dev/sdk/v3";

import { prAnalysisService } from "@/server/entities/pr-analysis/api/pr-analysis.service";
import { prisma } from "@/server/shared/infrastructure/db";
import { getClientContext } from "@/server/shared/infrastructure/github/github-provider";
import { prAnalysisLogger } from "@/server/shared/lib/pr-analysis-logger";

import { CommentFormatter, GitHubCommentPoster } from "../lib/comment-poster";
import { DifferentialAnalyzer } from "../lib/differential-analyzer";
import { PRConfigService } from "../lib/pr-config";

export const analyzePrTask = task({
  id: "analyze-pr",
  run: async (payload: {
    analysisId: number;
    baseSha: string;
    headSha: string;
    owner: string;
    prNumber: number;
    repoId: number;
    repoName: string;
  }) => {
    try {
      const startTime = Date.now();

      const repo = await prisma.repo.findUnique({
        select: { publicId: true, userId: true },
        where: { id: payload.repoId },
      });

      if (repo == null) throw new Error(`Repo with ID ${payload.repoId} not found`);

      // Get config
      const config = await PRConfigService.getConfig(repo.publicId, prisma);

      // Update status to ANALYZING
      await prAnalysisService.updateStatus(
        prisma,
        payload.analysisId,
        "ANALYZING" as PRAnalysisStatus
      );
      prAnalysisLogger.analyzeStarted(payload.repoId, payload.prNumber, config.tokenBudget);

      const { octokit } = await getClientContext(prisma, repo.userId, payload.owner);

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

      await prAnalysisService.storeChangedFilesSnapshot(
        prisma,
        payload.analysisId,
        changedFiles.map((file) => ({
          additions: file.additions,
          deletions: file.deletions,
          filePath: file.filename,
          previousFilePath: file.previousFilename,
          status: file.status,
        }))
      );

      // Run differential analysis
      const analyzer = new DifferentialAnalyzer(config);
      const result = await analyzer.analyzePRDiff({
        baseSha: payload.baseSha,
        changedFiles,
        headSha: payload.headSha,
        owner: payload.owner,
        prNumber: payload.prNumber,
        repoName: payload.repoName,
      });

      const finalFindings = [...result.findings];

      if (finalFindings.length === 0) {
        finalFindings.push({
          file: changedFiles[0]?.filename ?? "README.md",
          line: 1,
          message:
            "✅ **Doxynix Analysis Summary**:\n\nПроверка завершена. В предоставленном диффе критических уязвимостей, нарушений архитектуры или проблем с производительностью не обнаружено. Код соответствует установленным политикам проекта.",
          score: 0,
          severity: "LOW",
          suggestion: "Изменения выглядят безопасно. Можно продолжать ревью.",
          title: "Analysis Completed",
          type: "style",
        });
      }

      // Post comments
      if (config.commentStyle !== "OFF") {
        const poster = new GitHubCommentPoster(octokit);
        const postedComments = await poster.postComments(
          payload.owner,
          payload.repoName,
          payload.prNumber,
          payload.headSha,
          finalFindings,
          config.commentStyle
        );

        prAnalysisLogger.commentsPosted(payload.repoId, payload.prNumber, postedComments.length);

        // Store comments in DB
        if (postedComments.length > 0) {
          const dbComments = postedComments.map((c) => ({
            body: CommentFormatter.formatFinding(c.finding, config.commentStyle),
            filePath: c.finding.file,
            findingType: c.finding.type,
            line: c.finding.line,
            riskLevel: c.finding.score,
          }));
          await prAnalysisService.addComments(prisma, payload.analysisId, dbComments);
        }
      }

      // Update with results
      const duration = Date.now() - startTime;
      await prAnalysisService.updateStatus(
        prisma,
        payload.analysisId,
        "COMPLETED" as PRAnalysisStatus,
        {
          findingsJson: finalFindings as any,
          riskScore: result.riskScore,
        }
      );

      prAnalysisLogger.analyzeCompleted(
        payload.repoId,
        payload.prNumber,
        duration,
        result.findings.length
      );

      return {
        analysisId: payload.analysisId,
        duration,
        findings: result.findings.length,
        riskScore: result.riskScore,
        success: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      await prAnalysisService.updateStatus(
        prisma,
        payload.analysisId,
        "FAILED" as PRAnalysisStatus,
        {
          error: errorMsg,
        }
      );

      prAnalysisLogger.analyzeFailed(payload.repoId, payload.prNumber, errorMsg);

      throw error;
    }
  },
});
