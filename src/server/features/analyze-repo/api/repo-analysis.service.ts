import { DocType, Status, type Prisma, type Repo } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import type { AIResult } from "@/server/features/analyze-repo/lib/schemas";
import type { RepoMetrics } from "@/server/features/analyze-repo/lib/types";
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
import { calculateTeamRoles } from "@/server/shared/engine/metrics/common-metrics";
import { calculateHealthScore } from "@/server/shared/engine/metrics/complexity";
import { prisma, type DbClient } from "@/server/shared/infrastructure/db";
import { logger } from "@/server/shared/infrastructure/logger";
import { realtimeServer } from "@/server/shared/infrastructure/realtime";
import { getLatestCompletedAnalysisRef } from "@/server/shared/infrastructure/repo-snapshots";
import type { FileActionPreviewResult } from "@/server/shared/types";

export const repoAnalysisService = {
  async assertRepoAccess(db: DbClient, userId: number, repoId: string) {
    const repo = await db.repo.findFirst({
      where: { publicId: repoId, userId },
    });

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
    return repo;
  },
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
    const repo = await db.repo.findUnique({
      where: { publicId: input.repoId },
    });

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });

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
    await this.assertRepoAccess(db, userId, input.repoId);
    const nodeContext = await buildNodeContext(db, input.repoId, input.nodeId);

    const handle = await tasks.trigger(
      "analyze-single-file",
      {
        content: input.content,
        language: input.language,
        nodeContext: nodeContext ?? undefined,
        path: input.path,
        repoId: input.repoId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `analyze-file-${input.repoId}-${input.path}`,
        ttl: "10m",
      }
    );

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
    await this.assertRepoAccess(db, userId, input.repoId);
    const nodeContext = await buildNodeContext(db, input.repoId, input.nodeId);

    const handle = await tasks.trigger(
      "document-single-file",
      {
        content: input.content,
        language: input.language,
        nodeContext: nodeContext ?? undefined,
        path: input.path,
        repoId: input.repoId,
        userId,
      },
      {
        concurrencyKey: `user-${userId}`,
        idempotencyKey: `doc-file-${input.repoId}-${input.path}`,
        ttl: "10m",
      }
    );

    return { jobId: handle.id };
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
  ): Promise<QuickFileAuditResult & SyncFileActionMeta & FileActionPreviewResult> {
    await this.assertRepoAccess(db, userId, input.repoId);
    const [nodeContext, analysisRef] = await Promise.all([
      buildNodeContext(db, input.repoId, input.nodeId),
      getLatestCompletedAnalysisRef(db, input.repoId),
    ]);
    const result = await runQuickFileAudit({
      ...input,
      nodeContext: nodeContext ?? undefined,
    });

    const response = {
      ...result,
      ...buildSyncFileActionMeta({
        analysisRef,
        contentRef: {
          analysisId: input.analysisId,
          commitSha: input.commitSha,
        },
        contextDiagnostics: buildNodeContextDiagnostics(nodeContext),
        contextMeta: buildNodeContextMeta(nodeContext),
      }),
    };

    return {
      ...response,
      ...toQuickFileAuditPreview(response),
    };
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
  ): Promise<DocumentFilePreviewResult & SyncFileActionMeta & FileActionPreviewResult> {
    await this.assertRepoAccess(db, userId, input.repoId);
    const [nodeContext, analysisRef] = await Promise.all([
      buildNodeContext(db, input.repoId, input.nodeId),
      getLatestCompletedAnalysisRef(db, input.repoId),
    ]);
    const result = await runDocumentFilePreview({
      ...input,
      nodeContext: nodeContext ?? undefined,
    });

    const response = {
      ...result,
      ...buildSyncFileActionMeta({
        analysisRef,
        contentRef: {
          analysisId: input.analysisId,
          commitSha: input.commitSha,
        },
        contextDiagnostics: buildNodeContextDiagnostics(nodeContext),
        contextMeta: buildNodeContextMeta(nodeContext),
      }),
    };

    return {
      ...response,
      ...toDocumentFilePreview(response),
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
      maintenanceStatus:
        (Date.now() - new Date(repo.pushedAt!).getTime()) / (1000 * 60 * 60 * 24 * 30) > 12
          ? "dead"
          : (Date.now() - new Date(repo.pushedAt!).getTime()) / (1000 * 60 * 60 * 24 * 30) > 6
            ? "stale"
            : "active",
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
