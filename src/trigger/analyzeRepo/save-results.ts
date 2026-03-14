import { DocType, Status, type Prisma, type Repo } from "@prisma/client";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import type { AIResult } from "@/server/ai/schemas";
import type { RepoMetrics } from "@/server/ai/types";
import { prisma } from "@/server/db/db";
import { realtimeServer } from "@/server/lib/realtime";
import { logger } from "@/server/logger/logger";
import { GitHubAuthRequiredError, githubService } from "@/server/services/github.service";
import { calculateCodeMetrics, calculateHealthScore } from "@/server/utils/metrics";

export async function saveResults(params: {
  aiResult: AIResult;
  analysisId: string;
  busFactor: number;
  channelName: string;
  currentSha: string;
  repo: Repo;
  userId: number;
  validFiles: { content: string; path: string }[];
}) {
  const { aiResult, analysisId, busFactor, channelName, currentSha, repo, userId, validFiles } =
    params;

  const baseMetrics = calculateCodeMetrics(validFiles);

  const securityScoreRaw = aiResult.sections.security_audit.score;
  const securityScore = Math.round(securityScoreRaw * 10);

  const techDebtCount = aiResult.sections.tech_debt.length;
  const techDebtScore = Math.max(0, 100 - techDebtCount * 15);

  const complexityScore = Math.max(0, 100 - aiResult.refactoring_targets.length * 20);

  const docTypesPresent = [
    aiResult.generatedReadme,
    aiResult.generatedApiMarkdown,
    aiResult.generatedContributing,
    aiResult.generatedArchitecture,
  ].filter(Boolean).length;

  const onboardingScore = Math.min(
    100,
    docTypesPresent * 20 + (baseMetrics.docDensity > 10 ? 20 : 0)
  );

  const healthScoreAlgorithmic = calculateHealthScore(repo, busFactor, baseMetrics.docDensity);
  const finalHealthScore = Math.round(
    healthScoreAlgorithmic * 0.4 + securityScore * 0.2 + techDebtScore * 0.2 + onboardingScore * 0.2
  );

  aiResult.complexityScore = complexityScore;
  aiResult.techDebtScore = techDebtScore;
  aiResult.securityScore = securityScore;
  aiResult.onboardingScore = onboardingScore;

  aiResult.mostComplexFiles = aiResult.refactoring_targets.map((t) => t.file);

  aiResult.mainBottlenecks = aiResult.sections.performance;

  aiResult.vulnerabilities = aiResult.sections.security_audit.risks.map((risk) => ({
    description: risk,
    file: "See Audit Section",
    risk: "HIGH",
    suggestion: "Check Security Audit details",
  }));

  const metrics: RepoMetrics = {
    ...baseMetrics,
    busFactor,
    complexityScore,
    healthScore: finalHealthScore,
    maintenanceStatus:
      (Date.now() - new Date(repo.pushedAt!).getTime()) / (1000 * 60 * 60 * 24 * 30) > 6
        ? "stale"
        : "active",
    mostComplexFiles: aiResult.mostComplexFiles,
    onboardingScore,
    techDebtScore,
  };

  logger.info({
    analysisId,
    finalHealthScore,
    metricsSummary: {
      fileCount: metrics.fileCount,
      mostComplexFiles: metrics.mostComplexFiles.slice(0, 3),
      totalLoc: metrics.totalLoc,
    },
    msg: "Metrics computed, saving results",
    repoId: repo.id,
  });

  await prisma.$transaction(async (tx) => {
    const cleanResultJson = { ...aiResult };

    delete cleanResultJson.generatedReadme;
    delete cleanResultJson.generatedApiMarkdown;
    delete cleanResultJson.generatedContributing;
    delete cleanResultJson.generatedChangelog;
    delete cleanResultJson.generatedArchitecture;

    await tx.analysis.update({
      data: {
        commitSha: currentSha,
        complexityScore: complexityScore,
        message: "Completed successfully",

        metricsJson: metrics as unknown as Prisma.InputJsonValue,
        onboardingScore: onboardingScore,
        progress: 100,
        resultJson: cleanResultJson as Prisma.InputJsonValue,
        score: finalHealthScore,

        securityScore: securityScore,

        status: Status.DONE,

        techDebtScore: techDebtScore,
      },
      where: { publicId: analysisId },
    });

    const saveDoc = async (type: DocType, content: string | undefined) => {
      if (content == null) return;
      await tx.document.upsert({
        create: { content, repoId: repo.id, type, version: currentSha.substring(0, 7) },
        update: { content },
        where: {
          repoId_version_type: { repoId: repo.id, type, version: currentSha.substring(0, 7) },
        },
      });
    };

    await Promise.all([
      saveDoc(DocType.README, aiResult.generatedReadme),
      saveDoc(DocType.API, aiResult.generatedApiMarkdown),
      saveDoc(DocType.CONTRIBUTING, aiResult.generatedContributing),
      saveDoc(DocType.CHANGELOG, aiResult.generatedChangelog),
      saveDoc(DocType.ARCHITECTURE, aiResult.generatedArchitecture),
    ]);

    const note = await tx.notification.create({
      data: {
        body: `Health Score: ${finalHealthScore}/100`,
        repoId: repo.id,
        title: `Analysis for ${repo.owner}/${repo.name} ready`,
        type: "SUCCESS",
        userId,
      },
    });

    void realtimeServer.channels
      .get(channelName)
      .publish(REALTIME_CONFIG.events.user.notification, {
        id: note.publicId,
        title: note.title,
      });
  });
  logger.info({ analysisId, commitSha: currentSha, msg: "Results saved", repoId: repo.id });

  return finalHealthScore;
}

export async function calculateBusFactor(repo: Repo, userId: number): Promise<number> {
  try {
    const context = await githubService.resolveClientContext(prisma, userId, {
      allowPublicFallback: true,
      allowSystemFallback: true,
      owner: repo.owner,
    });
    const octokit = context.octokit;
    const clientType = context.type;

    if (repo.visibility === "PRIVATE" && (clientType === "app" || clientType === "public")) {
      throw new GitHubAuthRequiredError();
    }
    let fetchedContributors = 0;
    const contributors = await octokit.paginate(
      octokit.rest.repos.listContributors,
      { owner: repo.owner, per_page: 100, repo: repo.name },
      (response, done) => {
        fetchedContributors += response.data.length;
        if (fetchedContributors >= 500) done();
        return response.data;
      }
    );

    const totalCommits = contributors.reduce((acc, c) => acc + (c.contributions || 0), 0);
    if (totalCommits === 0) return 0;

    let runningSum = 0;
    let busFactor = 0;

    for (const c of contributors) {
      runningSum += c.contributions || 0;
      busFactor++;
      if (runningSum >= totalCommits * 0.5) break;
    }

    return busFactor;
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: number }).status)
        : undefined;
    const isMissingAuth = error instanceof GitHubAuthRequiredError;

    if (
      repo.visibility === "PRIVATE" &&
      (isMissingAuth || status === 401 || status === 403 || status === 404)
    ) {
      throw error;
    }

    if (isMissingAuth || status === 401 || status === 403 || status === 404) {
      logger.warn({
        error,
        msg: "Failed to fetch contributors for Bus Factor calculation. Defaulting to 0.",
        repoId: repo.id,
      });
      return 0;
    }

    throw error;
  }
}
