import type { Octokit } from "@octokit/rest";
import type { PRAnalysisStatus } from "@prisma/client";
import { task } from "@trigger.dev/sdk";
import { normalize } from "pathe";
import { z } from "zod";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { getClientContext } from "@/server/core/github/github-provider";
import { prAnalysisLogger } from "@/server/utils/pr-analysis-logger";
import { TASK_CONFIGS } from "@/server/utils/task-config";

import { analysisRepo } from "../analysis.repository";
import { persistedFindingSchema } from "../analysis.schemas";
import { CommentFormatter, gitHubCommentPoster } from "../logic/comment-poster";
import { DifferentialAnalyzer } from "../logic/differential-analyzer";
import { PRConfigService } from "../logic/pr-config";
import type { PRFinding } from "../logic/pr-types";
import { taskLogger } from "../logic/task-logger";

function mergePrBody(existingBody: null | string, aiSummary: string): string {
  const body = existingBody ?? "";
  const startMarker = "<!-- DOXYNIX_START -->";
  const endMarker = "<!-- DOXYNIX_END -->";

  const formattedSummary = `${startMarker}\n\n${aiSummary}\n\n${endMarker}`;

  const startIndex = body.indexOf(startMarker);
  const endIndex = body.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = body.slice(0, startIndex);
    const after = body.slice(endIndex + endMarker.length);
    return `${before}${formattedSummary}${after}`;
  }

  if (body.trim().length === 0) {
    return formattedSummary;
  }

  return `${body}\n\n---\n\n${formattedSummary}`;
}

function getCommentableLinesFromPatch(patch: string): Set<number> {
  const commentable = new Set<number>();
  if (!patch) return commentable;

  const lines = patch.split("\n");
  let currentNewFileLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match?.[1] != null) {
        currentNewFileLine = Number.parseInt(match[1], 10);
      }
      continue;
    }

    if (currentNewFileLine === 0) continue;

    if (line.startsWith("+")) {
      if (!line.startsWith("+++")) {
        commentable.add(currentNewFileLine);
        currentNewFileLine++;
      }
    } else if (line.startsWith("-")) {
      if (line.startsWith("---")) continue;
    } else {
      commentable.add(currentNewFileLine);
      currentNewFileLine++;
    }
  }

  return commentable;
}

function buildLineMappingFromPatch(patch: string): Map<string, number> {
  const lineMap = new Map<string, number>();
  if (!patch) return lineMap;

  const lines = patch.split("\n");
  let currentNewFileLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match?.[1] != null) {
        currentNewFileLine = Number.parseInt(match[1], 10);
      }
      continue;
    }

    if (currentNewFileLine === 0) continue;

    if (line.startsWith("+")) {
      if (!line.startsWith("+++")) {
        const cleanText = line.slice(1).trim();
        if (cleanText.length > 0) {
          lineMap.set(cleanText, currentNewFileLine);
        }
        currentNewFileLine++;
      }
    } else if (line.startsWith("-")) {
      if (line.startsWith("---")) continue;
    } else {
      currentNewFileLine++;
    }
  }

  return lineMap;
}

function getTokens(line: string): string[] {
  return line
    .trim()
    .toLowerCase()
    .split(/[\s()\[\]{}.,;+\-*/=<>!]+/gu)
    .filter(Boolean);
}

function calculateLineSimilarity(line1: string, line2: string): number {
  const t1 = getTokens(line1);
  const t2 = getTokens(line2);
  if (t1.length === 0 && t2.length === 0) return 1.0;
  if (t1.length === 0 || t2.length === 0) return 0.0;

  const set1 = new Set(t1);
  const set2 = new Set(t2);
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

function healFindingLine(
  lineMap: Map<string, number>,
  codeSnippet: string,
  hallucinatedLine: number
): number {
  const snippetLines = codeSnippet
    .split("\n")
    .map((l) => l.replace(/^[+-]/, "").trim())
    .filter(Boolean);

  for (const snippetLine of snippetLines) {
    const exact = lineMap.get(snippetLine);
    if (exact != null) return exact;

    for (const [mapText, mapLine] of lineMap.entries()) {
      if (mapText.includes(snippetLine) || snippetLine.includes(mapText)) {
        return mapLine;
      }
    }

    let bestScore = 0;
    let bestLine = hallucinatedLine;
    for (const [mapText, mapLine] of lineMap.entries()) {
      const score = calculateLineSimilarity(snippetLine, mapText);
      if (score > bestScore && score > 0.75) {
        bestScore = score;
        bestLine = mapLine;
      }
    }
    if (bestScore > 0) return bestLine;
  }

  return hallucinatedLine;
}

async function updateCommitStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  state: "error" | "failure" | "pending" | "success",
  description: string,
  prNumber: number
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

      if (repo == null) throw new Error(`Repo with ID ${payload.repoId} not found`);

      const { octokit } = await getClientContext(prisma, repo.userId, payload.owner);
      octokitInstance = octokit;

      await updateCommitStatus(
        octokit,
        payload.owner,
        payload.repoName,
        payload.headSha,
        "pending",
        "Doxynix is analyzing your changes...",
        payload.prNumber
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

      await analysisRepo.updatePRAnalysisStatus(
        prisma,
        payload.analysisId,
        "ANALYZING" as PRAnalysisStatus
      );

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
        }))
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
        }
      );

      const fileLineMaps = new Map<string, Map<string, number>>();
      const fileCommentableLines = new Map<string, Set<number>>();

      for (const file of changedFiles) {
        if (file.patch != null) {
          const normName = normalize(file.filename);
          fileLineMaps.set(normName, buildLineMappingFromPatch(file.patch));
          fileCommentableLines.set(normName, getCommentableLinesFromPatch(file.patch));
        }
      }

      const validatedInlineFindings: PRFinding[] = [];

      for (const finding of result.findings) {
        const normPath = normalize(finding.file);
        const lineMap = fileLineMaps.get(normPath);
        const commentableLines = fileCommentableLines.get(normPath);

        let correctedLine = finding.line;
        if (lineMap != null && finding.codeSnippet != null) {
          correctedLine = healFindingLine(lineMap, finding.codeSnippet, finding.line);
        }

        const updatedFinding = {
          ...finding,
          line: correctedLine,
        };

        if (commentableLines != null && commentableLines.has(correctedLine)) {
          validatedInlineFindings.push(updatedFinding);
        } else {
          finding.line = correctedLine;
        }
      }

      if (result.summary && result.summary.trim().length > 0) {
        try {
          await gitHubCommentPoster.postMainDashboardComment(
            octokit,
            payload.owner,
            payload.repoName,
            payload.prNumber,
            result.findings
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
          config.commentStyle
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

      await analysisRepo.updatePRAnalysisStatus(
        prisma,
        payload.analysisId,
        "COMPLETED" as PRAnalysisStatus,
        {
          findingsJson: validated.success ? validated.data : candidate,
          riskScore: result.riskScore,
        }
      );

      await updateCommitStatus(
        octokit,
        payload.owner,
        payload.repoName,
        payload.headSha,
        "success",
        `Doxynix Analysis completed. ${result.findings.length} findings identified.`,
        payload.prNumber
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
      taskLogger.error(`CRITICAL Task Execution Failed: ${errorMsg}`);

      if (octokitInstance != null) {
        await updateCommitStatus(
          octokitInstance,
          payload.owner,
          payload.repoName,
          payload.headSha,
          "failure",
          `Doxynix Analysis failed: ${errorMsg}`,
          payload.prNumber
        );
      }

      await analysisRepo.updatePRAnalysisStatus(
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
