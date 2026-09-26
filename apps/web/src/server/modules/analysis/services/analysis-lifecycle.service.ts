import { DocType, Status } from "@doxynix/shared";
import type { Prisma, Repo } from "@prisma/client";
import { auth, runs, tasks } from "@trigger.dev/sdk";
import { TRPCError } from "@trpc/server";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { appLogger } from "@/server/core/app-logger";
import { type DbClient, prisma } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { calculateTeamRoles } from "../engine/metrics/common-metrics";
import {
  buildFinalMetrics,
  buildResultToStore,
  computeHealthScore,
  computeOnboardingScore,
} from "../logic/analysis-scoring";
import { calculateDocumentationOutputScore } from "../logic/doc-priority";
import { docSyncService, type GeneratedDocsData } from "./doc-sync.service";

export type SaveResultsParams = {
  aiResult: AIResult;
  analysisId: string;
  busFactor: number;
  channelName: string;
  currentSha: string;
  generatedDocsData: GeneratedDocsData;
  hardMetrics: RepoMetrics;
  rawContributors: { contributions: number; login: string }[];
  repo: Repo;
  repositoryFacts: NonNullable<AIResult["repository_facts"]>;
  repositoryFindings: NonNullable<AIResult["findings"]>;
  userId: number;
};

export const analysisLifecycleService = {
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
    },
  ) {
    await this.assertRepoAccess(db, userId, input.repoId);

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
        // concurrencyKey: `user-${userId}`,
        // idempotencyKey: `analysis-${analysis.publicId}`,
        ttl: "30m",
      },
    );

    await db.analysis.update({
      data: { jobId: handle.id },
      where: { publicId: analysis.publicId },
    });

    return { jobId: handle.id, publicAccessToken: handle.publicAccessToken, status: "QUEUED" };
  },

  async assertRepoAccess(db: DbClient, userId: number, repoId: string) {
    const repo = await db.repo.findFirst({
      where: { publicId: repoId, userId },
    });

    if (repo == null) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    return repo;
  },

  async cancel(db: DbClient, analysisId: string) {
    const analysis = await db.analysis.findFirst({
      where: { publicId: analysisId },
    });

    if (analysis == null) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Analysis record not found",
      });
    }

    if (analysis.status === "PENDING") {
      await db.analysis.update({
        data: {
          message: "Analysis aborted by user or timed out.",
          progress: 100,
          status: "FAILED",
        },
        where: { publicId: analysis.publicId },
      });

      if (analysis.jobId != null) {
        try {
          await runs.cancel(analysis.jobId);

          appLogger.info({
            analysisId: analysis.publicId,
            jobId: analysis.jobId,
            msg: "Successfully canceled active Trigger.dev run on cloud",
          });
        } catch (error) {
          appLogger.error({
            analysisId: analysis.publicId,
            error: error instanceof Error ? error.message : String(error),
            jobId: analysis.jobId,
            msg: "Failed to programmatically cancel Trigger.dev run on cloud",
          });
        }
      }
    }

    return { success: true };
  },

  async getHistory(db: DbClient, repoId: string) {
    const history = await db.analysis.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        commitSha: true,
        createdAt: true,
        message: true,
        publicId: true,
        score: true,
        status: true,
      },
      where: { repo: { publicId: repoId } },
    });

    return history.map((h) => ({
      commitSha: h.commitSha,
      createdAt: h.createdAt,
      id: h.publicId,
      message: h.message,
      score: h.score,
      status: h.status,
    }));
  },

  async getLatest(db: DbClient, repoId: string) {
    const analysis = await db.analysis.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        repo: { publicId: repoId },
      },
    });

    if (analysis == null) {
      return null;
    }

    let publicAccessToken: null | string = null;

    if (analysis.status === "PENDING" && analysis.jobId != null) {
      try {
        publicAccessToken = await auth.createPublicToken({
          expirationTime: "1h",
          scopes: {
            read: {
              runs: [analysis.jobId],
            },
          },
        });
      } catch (error) {
        appLogger.error({ error, msg: "Trigger.dev auth error:" });
      }
    }

    return {
      ...analysis,
      publicAccessToken,
    };
  },

  async saveResults(params: SaveResultsParams): Promise<number> {
    const {
      aiResult,
      analysisId,
      busFactor,
      currentSha,
      generatedDocsData,
      hardMetrics,
      rawContributors,
      repo,
      repositoryFacts,
      repositoryFindings,
      userId,
    } = params;

    const teamRoles = calculateTeamRoles(rawContributors);

    const docOutputScore = calculateDocumentationOutputScore({
      ...aiResult,
      ...generatedDocsData,
    });

    const onboardingScore = computeOnboardingScore({
      docOutputScore: docOutputScore.score,
      hardMetrics,
      repositoryFacts,
    });

    const finalHealthScore = computeHealthScore({ busFactor, hardMetrics, repo });

    const resultToStore = buildResultToStore({
      aiResult,
      hardMetrics,
      onboardingScore,
      repositoryFacts,
      repositoryFindings,
    });

    const finalMetrics = buildFinalMetrics({
      busFactor,
      factCount: repositoryFacts.length,
      finalHealthScore,
      findingCount: repositoryFindings.length,
      hardMetrics,
      onboardingScore,
      repo,
      teamRoles,
    });

    appLogger.info({
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
          resultJson: resultToStore as unknown as Prisma.InputJsonValue,
          score: finalHealthScore,
          securityScore: hardMetrics.securityScore,
          status: Status.DONE,
          techDebtScore: hardMetrics.techDebtScore,
        },
        where: { publicId: analysisId },
      });

      const rawDocs: Array<{ content?: string; type: DocType }> = [
        { content: generatedDocsData.generatedReadme, type: DocType.README },
        { content: generatedDocsData.generatedApiMarkdown, type: DocType.API },
        { content: generatedDocsData.generatedContributing, type: DocType.CONTRIBUTING },
        { content: generatedDocsData.generatedChangelog, type: DocType.CHANGELOG },
        { content: generatedDocsData.generatedArchitecture, type: DocType.ARCHITECTURE },
      ];

      const docsToSave = rawDocs.flatMap((doc) =>
        doc.content != null && doc.content.length > 0
          ? [{ content: doc.content, type: doc.type }]
          : [],
      );

      await Promise.all(
        docsToSave.map((doc) =>
          tx.document.upsert({
            create: {
              analysisId: analysis.id,
              content: doc.content,
              repoId: repo.id,
              type: doc.type,
              version: currentSha,
            },
            update: { content: doc.content },
            where: {
              repoId_version_type_analysisId: {
                analysisId: analysis.id,
                repoId: repo.id,
                type: doc.type,
                version: currentSha,
              },
            },
          }),
        ),
      );

      return tx.notification.create({
        data: {
          body: `Health Score: ${finalHealthScore}/100`,
          repoId: repo.id,
          title: `Analysis for ${repo.owner}/${repo.name} ready`,
          type: "SUCCESS",
          userId,
        },
      });
    });

    await realtimeService.user(userId).publish(REALTIME_CONFIG.events.user.notification, {
      id: note.publicId,
      title: note.title,
    });

    appLogger.info({ analysisId, commitSha: currentSha, msg: "Results saved", repoId: repo.id });

    docSyncService
      .autoSyncDocsToGithub(prisma, repo, generatedDocsData, currentSha)
      .catch((error) => {
        appLogger.error({
          error,
          msg: "Failed background auto-sync of documentation to GitHub",
          repoId: repo.id,
        });
      });

    return finalHealthScore;
  },
};
