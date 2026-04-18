import { DocType, Status, type Prisma, type Repo } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { buildSyncFileActionMeta } from "@/server/features/file-actions/model/repo-file-action-state";
import {
  buildNodeContext,
  buildNodeContextDiagnostics,
  buildNodeContextMeta,
} from "@/server/features/file-actions/model/repo-node-context";
import { calculateDocumentationOutputScore } from "@/server/features/generate-docs/lib/doc-priority";
import type { AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { calculateTeamRoles } from "@/server/shared/engine/metrics/common-metrics";
import { calculateHealthScore } from "@/server/shared/engine/metrics/complexity";
import { prisma, type DbClient } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";
import { realtimeServer } from "@/server/shared/infrastructure/realtime";
import { getLatestCompletedAnalysisRef } from "@/server/shared/infrastructure/repo-snapshots";

type SaveResultsParams = {
  aiResult: AIResult;
  analysisId: string;
  busFactor: number;
  channelName: string;
  currentSha: string;
  hardMetrics: RepoMetrics;
  rawContributors: { contributions: number; login: string }[];
  repo: Repo;
  repositoryFacts: NonNullable<AIResult["repository_facts"]>;
  repositoryFindings: NonNullable<AIResult["findings"]>;
  userId: number;
};

export const repoAnalysisService = {
  async analyze(
    db: DbClient,
    userId: number,
    input: {
      branch?: string;
      docTypes: DocType[];
      files: string[];
      instructions?: string;
      language: string;
      repoId: string;
    }
  ) {
    await assertRepoAccess(db, userId, input.repoId);

    const analysis = await db.analysis.create({
      data: {
        repo: {
          connect: {
            publicId: input.repoId,
          },
        },
        status: "PENDING",
      },
    });

    const handle = await tasks.trigger(
      "analyze-repo",
      {
        analysisId: analysis.publicId,
        docTypes: input.docTypes,
        instructions: input.instructions,
        language: input.language,
        selectedBranch: input.branch,
        selectedFiles: input.files,
        userId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `analysis-${analysis.publicId}`,
        ttl: "30m",
      }
    );

    await db.analysis.update({
      data: { jobId: handle.id },
      where: { publicId: analysis.publicId },
    });

    return { jobId: handle.id, status: "QUEUED" };
  },

  async auditFile(db: DbClient, userId: number, input: any) {
    return this.runFileAction(db, userId, "analyze-single-file", input);
  },

  async documentFile(db: DbClient, userId: number, input: any) {
    return this.runFileAction(db, userId, "document-single-file", input);
  },

  async runFileAction(
    db: DbClient,
    userId: number,
    taskId: "analyze-single-file" | "document-single-file",
    input: {
      analysisId?: string;
      commitSha?: string;
      content: string;
      language: string;
      nodeId?: string;
      path: string;
      repoId: string;
    }
  ) {
    await assertRepoAccess(db, userId, input.repoId);

    const { analysisRef, nodeContext } = await buildFileActionRuntimeContext(db, input);

    const syncMeta = buildSyncFileMeta(input, nodeContext, analysisRef);

    const handle = await tasks.trigger(
      taskId,
      {
        content: input.content,
        language: input.language,
        nodeContext: nodeContext ?? undefined,
        path: input.path,
        repoId: input.repoId,
        syncMeta,
        userId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `${taskId}-${input.repoId}-${input.path}`,
        ttl: "10m",
      }
    );

    return { jobId: handle.id };
  },

  async saveResults(params: SaveResultsParams) {
    const {
      aiResult,
      analysisId,
      busFactor,
      channelName,
      currentSha,
      hardMetrics,
      rawContributors,
      repo,
      repositoryFacts,
      repositoryFindings,
      userId,
    } = params;

    const {
      generatedApiMarkdown,
      generatedArchitecture,
      generatedChangelog,
      generatedContributing,
      generatedReadme,
      ...cleanAiResult
    } = aiResult;

    const teamRoles = calculateTeamRoles(rawContributors);
    const docOutputScore = calculateDocumentationOutputScore(aiResult);

    const onboardingScore = Math.min(
      100,
      docOutputScore.score +
        (hardMetrics.docDensity > 10 ? 10 : 0) +
        (hardMetrics.entrypoints.length > 0 ? 15 : 0) +
        (hardMetrics.configFiles > 0 ? 10 : 0) +
        (repositoryFacts.some((fact) => fact.category === "architecture") ? 10 : 0)
    );

    const finalHealthScore = calculateHealthScore({
      busFactor,
      complexityScore: hardMetrics.complexityScore,
      dependencyCycles: hardMetrics.dependencyCycles.length,
      docDensity: hardMetrics.docDensity,
      duplicationPercentage: hardMetrics.duplicationPercentage,
      repo,
      securityScore: hardMetrics.securityScore,
      techDebtScore: hardMetrics.techDebtScore,
    });

    const resultToStore = {
      ...cleanAiResult,
      complexityScore: hardMetrics.complexityScore,
      findings: repositoryFindings,
      mostComplexFiles: hardMetrics.mostComplexFiles,
      onboardingScore,
      repository_facts: repositoryFacts,
      securityScore: hardMetrics.securityScore,
      techDebtScore: hardMetrics.techDebtScore,
      vulnerabilities: hardMetrics.securityFindings.map((f) => ({
        description: f.message,
        file: f.path,
        lineHint: f.line != null ? `line ${f.line}` : undefined,
        risk: f.severity === "error" ? "HIGH" : "MODERATE",
        suggestion:
          "Review the flagged secret-like value and replace it with a safe managed secret.",
      })),
    };

    const finalMetrics: RepoMetrics = {
      ...hardMetrics,
      busFactor,
      factCount: repositoryFacts.length,
      findingCount: repositoryFindings.length,
      healthScore: finalHealthScore,
      maintenanceStatus: deriveMaintenanceStatus(repo),
      onboardingScore,
      teamRoles,
    };

    logger.info({
      analysisId,
      finalHealthScore,
      metricsSummary: {
        docs: docOutputScore.snapshot,
        fileCount: finalMetrics.fileCount,
        mostComplexFiles: finalMetrics.mostComplexFiles,
        totalLoc: finalMetrics.totalLoc,
      },
      msg: "Metrics computed, saving results",
      repoId: repo.id,
    });

    const note = await prisma.$transaction(async (tx) => {
      const analysis = await tx.analysis.update({
        data: {
          commitSha: currentSha,
          complexityScore: hardMetrics.complexityScore,
          message: "Completed successfully",
          metricsJson: finalMetrics as unknown as Prisma.InputJsonValue,
          onboardingScore: onboardingScore,
          progress: 100,
          resultJson: resultToStore as Prisma.InputJsonValue,
          score: finalHealthScore,
          securityScore: hardMetrics.securityScore,
          status: Status.DONE,
          techDebtScore: hardMetrics.techDebtScore,
        },
        where: { publicId: analysisId },
      });

      const docsToSave = [
        { content: generatedReadme, type: DocType.README },
        { content: generatedApiMarkdown, type: DocType.API },
        { content: generatedContributing, type: DocType.CONTRIBUTING },
        { content: generatedChangelog, type: DocType.CHANGELOG },
        { content: generatedArchitecture, type: DocType.ARCHITECTURE },
      ].filter((doc) => doc.content != null && doc.content.length > 0);

      await Promise.all(
        docsToSave.map((doc) =>
          tx.document.upsert({
            create: {
              analysisId: analysis.id,
              content: doc.content!,
              repoId: repo.id,
              type: doc.type,
              version: currentSha,
            },
            update: { content: doc.content! },
            where: {
              repoId_version_type_analysisId: {
                analysisId: analysis.id,
                repoId: repo.id,
                type: doc.type,
                version: currentSha,
              },
            },
          })
        )
      );

      return await tx.notification.create({
        data: {
          body: `Health Score: ${finalHealthScore}/100`,
          repoId: repo.id,
          title: `Analysis for ${repo.owner}/${repo.name} ready`,
          type: "SUCCESS",
          userId,
        },
      });
    });

    await realtimeServer.channels
      .get(channelName)
      .publish(REALTIME_CONFIG.events.user.notification, {
        id: note.publicId,
        title: note.title,
      });

    logger.info({ analysisId, commitSha: currentSha, msg: "Results saved", repoId: repo.id });

    return finalHealthScore;
  },
};

async function assertRepoAccess(db: DbClient, userId: number, repoId: string) {
  const repo = await db.repo.findFirst({
    where: { publicId: repoId, userId },
  });

  if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
  return repo;
}

async function buildFileActionRuntimeContext(
  db: DbClient,
  input: { nodeId?: string; repoId: string }
) {
  const [nodeContext, analysisRef] = await Promise.all([
    buildNodeContext(db, input.repoId, input.nodeId),
    getLatestCompletedAnalysisRef(db, input.repoId),
  ]);

  return { analysisRef, nodeContext };
}

function buildSyncFileMeta(
  input: { analysisId?: string; commitSha?: string },
  nodeContext: Awaited<ReturnType<typeof buildNodeContext>>,
  analysisRef: Awaited<ReturnType<typeof getLatestCompletedAnalysisRef>>
) {
  return buildSyncFileActionMeta({
    analysisRef,
    contentRef: {
      analysisId: input.analysisId,
      commitSha: input.commitSha,
    },
    contextDiagnostics: buildNodeContextDiagnostics(nodeContext),
    contextMeta: buildNodeContextMeta(nodeContext),
  });
}

function deriveMaintenanceStatus(repo: Repo) {
  const pushedAt = repo.pushedAt ?? repo.updatedAt;
  const ageInMonths = (Date.now() - new Date(pushedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (ageInMonths > 12) return "dead" as const;
  if (ageInMonths > 6) return "stale" as const;
  return "active" as const;
}
