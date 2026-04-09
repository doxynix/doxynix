import { DocType, Status, type Prisma, type Repo } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import {
  runDocumentFilePreview,
  runQuickFileAudit,
  type DocumentFilePreviewResult,
  type QuickFileAuditResult,
} from "@/server/features/file-actions/model/file-actions";
import {
  toDocumentFilePreview,
  toQuickFileAuditPreview,
} from "@/server/features/file-actions/model/repo-file-action-preview";
import {
  buildSyncFileActionMeta,
  type SyncFileActionMeta,
} from "@/server/features/file-actions/model/repo-file-action-state";
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
import type { FileActionPreviewResult } from "@/server/shared/types";

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
  async analyzeFile(
    db: DbClient,
    userId: number,
    input: {
      content: string;
      language: string;
      nodeId?: string;
      path: string;
      repoId: string;
    }
  ) {
    await assertRepoAccess(db, userId, input.repoId);
    const nodeContext = await buildNodeContext(db, input.repoId, input.nodeId);

    const handle = await triggerSingleFileTask({
      payload: {
        content: input.content,
        language: input.language,
        nodeContext: nodeContext ?? undefined,
        path: input.path,
        repoId: input.repoId,
      },
      taskId: "analyze-single-file",
      userId,
      workItemId: `analyze-file-${input.repoId}-${input.path}`,
    });

    return { jobId: handle.id };
  },

  async documentFile(
    db: DbClient,
    userId: number,
    input: {
      content: string;
      language: string;
      nodeId?: string;
      path: string;
      repoId: string;
    }
  ) {
    await assertRepoAccess(db, userId, input.repoId);
    const nodeContext = await buildNodeContext(db, input.repoId, input.nodeId);

    const handle = await triggerSingleFileTask({
      payload: {
        content: input.content,
        language: input.language,
        nodeContext: nodeContext ?? undefined,
        path: input.path,
        repoId: input.repoId,
        userId,
      },
      taskId: "document-single-file",
      userId,
      workItemId: `doc-file-${input.repoId}-${input.path}`,
    });

    return { jobId: handle.id };
  },

  async documentFilePreview(
    db: DbClient,
    userId: number,
    input: {
      analysisId?: string;
      commitSha?: string;
      content: string;
      language: string;
      nodeId?: string;
      path: string;
      repoId: string;
    }
  ): Promise<DocumentFilePreviewResult & FileActionPreviewResult & SyncFileActionMeta> {
    await assertRepoAccess(db, userId, input.repoId);
    const { analysisRef, nodeContext } = await buildFileActionRuntimeContext(db, input);
    const result = await runDocumentFilePreview({
      ...input,
      nodeContext: nodeContext ?? undefined,
    });

    const response = {
      ...result,
      ...buildSyncFileMeta(input, nodeContext, analysisRef),
    };

    return {
      ...response,
      ...toDocumentFilePreview(response),
    };
  },

  async quickFileAudit(
    db: DbClient,
    userId: number,
    input: {
      analysisId?: string;
      commitSha?: string;
      content: string;
      language: string;
      nodeId?: string;
      path: string;
      repoId: string;
    }
  ): Promise<FileActionPreviewResult & QuickFileAuditResult & SyncFileActionMeta> {
    await assertRepoAccess(db, userId, input.repoId);
    const { analysisRef, nodeContext } = await buildFileActionRuntimeContext(db, input);
    const result = await runQuickFileAudit({
      ...input,
      nodeContext: nodeContext ?? undefined,
    });

    const response = {
      ...result,
      ...buildSyncFileMeta(input, nodeContext, analysisRef),
    };

    return {
      ...response,
      ...toQuickFileAuditPreview(response),
    };
  },

  async saveResults(params: {
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
  }) {
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

    aiResult.complexityScore = hardMetrics.complexityScore;
    aiResult.findings = repositoryFindings;
    aiResult.mostComplexFiles = hardMetrics.mostComplexFiles;
    aiResult.onboardingScore = onboardingScore;
    aiResult.repository_facts = repositoryFacts;
    aiResult.techDebtScore = hardMetrics.techDebtScore;
    aiResult.securityScore = hardMetrics.securityScore;
    aiResult.vulnerabilities = hardMetrics.securityFindings.map((finding) => ({
      description: finding.message,
      file: finding.path,
      lineHint: finding.line != null ? `line ${finding.line}` : undefined,
      risk: finding.severity === "error" ? "HIGH" : "MODERATE",
      suggestion:
        "Review the flagged secret-like value and replace it with a safe placeholder or managed secret.",
    }));

    const metrics: RepoMetrics = {
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
        fileCount: metrics.fileCount,
        mostComplexFiles: metrics.mostComplexFiles,
        primaryDocs: docOutputScore.snapshot.primary,
        secondaryDocs: docOutputScore.snapshot.secondary,
        totalLoc: metrics.totalLoc,
      },
      msg: "Metrics computed, saving results",
      repoId: repo.id,
    });

    const note = await prisma.$transaction(async (tx) => {
      const cleanResultJson = { ...aiResult };

      delete cleanResultJson.generatedReadme;
      delete cleanResultJson.generatedApiMarkdown;
      delete cleanResultJson.generatedContributing;
      delete cleanResultJson.generatedChangelog;
      delete cleanResultJson.generatedArchitecture;

      await tx.analysis.update({
        data: {
          commitSha: currentSha,
          complexityScore: hardMetrics.complexityScore,
          message: "Completed successfully",
          metricsJson: metrics as unknown as Prisma.InputJsonValue,
          onboardingScore: onboardingScore,
          progress: 100,
          resultJson: cleanResultJson as Prisma.InputJsonValue,
          score: finalHealthScore,
          securityScore: hardMetrics.securityScore,
          status: Status.DONE,
          techDebtScore: hardMetrics.techDebtScore,
        },
        where: { publicId: analysisId },
      });

      const saveDoc = async (type: DocType, content: string | undefined) => {
        if (content == null) return;
        await tx.document.upsert({
          create: { content, repoId: repo.id, type, version: currentSha },
          update: { content },
          where: {
            repoId_version_type: { repoId: repo.id, type, version: currentSha },
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

async function triggerSingleFileTask<TPayload extends object>(params: {
  payload: TPayload;
  taskId: "analyze-single-file" | "document-single-file";
  userId: number;
  workItemId: string;
}) {
  return tasks.trigger(params.taskId, params.payload, {
    concurrencyKey: `user-${params.userId}`,
    idempotencyKey: params.workItemId,
    ttl: "10m",
  });
}
