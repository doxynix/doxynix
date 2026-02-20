import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/api/db/db";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";
import { logger } from "@/shared/lib/logger";

import { StatusSchema, type Repo } from "@/generated/zod";
import DocTypeSchema, { type DocTypeType } from "@/generated/zod/inputTypeSchemas/DocTypeSchema";
import type { AIResult } from "@/server/ai/schemas";
import type { RepoMetrics } from "@/server/ai/types";
import { realtimeServer } from "@/server/lib/realtime";
import { githubService } from "@/server/services/github.service";
import { calculateCodeMetrics, calculateHealthScore } from "@/server/utils/metrics";

export async function saveResults(params: {
  analysisId: string;
  repo: Repo;
  userId: number;
  validFiles: { path: string; content: string }[];
  aiResult: AIResult;
  busFactor: number;
  currentSha: string;
  channelName: string;
}) {
  const { analysisId, repo, userId, validFiles, aiResult, busFactor, currentSha, channelName } =
    params;

  const baseMetrics = calculateCodeMetrics(validFiles);

  const securityScoreRaw = aiResult.sections.security_audit.score ?? 5;
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
    file: "See Audit Section",
    risk: "HIGH",
    description: risk,
    suggestion: "Check Security Audit details",
  }));

  const metrics: RepoMetrics = {
    ...baseMetrics,
    busFactor,
    healthScore: finalHealthScore,
    onboardingScore,
    techDebtScore,
    complexityScore,
    mostComplexFiles: aiResult.mostComplexFiles,
    maintenanceStatus:
      (Date.now() - new Date(repo.pushedAt!).getTime()) / (1000 * 60 * 60 * 24 * 30) > 6
        ? "stale"
        : "active",
  };

  logger.info({
    msg: "Metrics computed, saving results",
    analysisId,
    repoId: repo.id,
    finalHealthScore,
    metricsSummary: {
      totalLoc: metrics.totalLoc,
      fileCount: metrics.fileCount,
      mostComplexFiles: metrics.mostComplexFiles.slice(0, 3),
    },
  });

  await prisma.$transaction(async (tx) => {
    const cleanResultJson = { ...aiResult };

    delete cleanResultJson.generatedReadme;
    delete cleanResultJson.generatedApiMarkdown;
    delete cleanResultJson.generatedContributing;
    delete cleanResultJson.generatedChangelog;
    delete cleanResultJson.generatedArchitecture;

    await tx.analysis.update({
      where: { publicId: analysisId },
      data: {
        status: StatusSchema.enum.DONE,
        progress: 100,
        message: "Completed successfully",

        score: finalHealthScore,
        securityScore: securityScore,
        complexityScore: complexityScore,
        techDebtScore: techDebtScore,
        onboardingScore: onboardingScore,

        metricsJson: metrics as unknown as Prisma.InputJsonValue,

        resultJson: cleanResultJson as Prisma.InputJsonValue,

        commitSha: currentSha,
      },
    });

    const saveDoc = async (type: DocTypeType, content: string | undefined) => {
      if (content == null) return;
      await tx.document.upsert({
        where: {
          repoId_version_type: { repoId: repo.id, version: currentSha.substring(0, 7), type },
        },
        create: { repoId: repo.id, version: currentSha.substring(0, 7), type, content },
        update: { content },
      });
    };

    await Promise.all([
      saveDoc(DocTypeSchema.enum.README, aiResult.generatedReadme),
      saveDoc(DocTypeSchema.enum.API, aiResult.generatedApiMarkdown),
      saveDoc(DocTypeSchema.enum.CONTRIBUTING, aiResult.generatedContributing),
      saveDoc(DocTypeSchema.enum.CHANGELOG, aiResult.generatedChangelog),
      saveDoc(DocTypeSchema.enum.ARCHITECTURE, aiResult.generatedArchitecture),
    ]);

    const note = await tx.notification.create({
      data: {
        userId,
        title: `Analysis for ${repo.name} ready`,
        body: `Health Score: ${finalHealthScore}/100`,
        type: "SUCCESS",
      },
    });

    void realtimeServer.channels
      .get(channelName)
      ?.publish(REALTIME_CONFIG.events.user.notification, {
        id: note.publicId,
        title: note.title,
      });
  });
  logger.info({ msg: "Results saved", analysisId, repoId: repo.id, commitSha: currentSha });

  return finalHealthScore;
}

export async function calculateBusFactor(repo: Repo, userId: number): Promise<number> {
  const octokit = await githubService.getClientForUser(prisma, userId);
  const { data: contributors } = await octokit.repos.listContributors({
    owner: repo.owner,
    repo: repo.name,
    per_page: 100,
  });

  const totalCommits = contributors.reduce((acc, c) => acc + (c.contributions || 0), 0);
  let runningSum = 0;
  let busFactor = 0;

  for (const c of contributors) {
    runningSum += c.contributions || 0;
    busFactor++;
    if (runningSum >= totalCommits * 0.5) break;
  }

  return busFactor;
}
