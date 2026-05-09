import os from "node:os";
import { Status, type DocType } from "@prisma/client";
import { task } from "@trigger.dev/sdk";
import { join } from "pathe";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { analyzeRepository } from "@/server/shared/engine/metrics/code-metrics";
import {
  calculateTeamRoles,
  computeChangeCoupling,
  computeGitChurnHotspots,
} from "@/server/shared/engine/metrics/common-metrics";
import { buildRepositoryArtifacts } from "@/server/shared/engine/pipeline/artifacts";
import { buildDocumentationInputModel } from "@/server/shared/engine/pipeline/documentation-input";
import { prisma } from "@/server/shared/infrastructure/db";
import { cloneRepository, getAnalysisContext } from "@/server/shared/infrastructure/github/git";
import { calculateBusFactor } from "@/server/shared/infrastructure/github/github-api";
import { logger } from "@/server/shared/infrastructure/logger";
import { taskLogger } from "@/server/shared/lib/task-logger";
import { cleanup, handleError, readAndFilterFiles } from "@/server/shared/lib/utils";

import { repoAnalysisService } from "../api/repo-analysis.service";
import { generateDeepDocs, runAiPipeline } from "../model/ai-pipeline";

type TaskPayload = {
  analysisId: string;
  docTypes: DocType[];
  forceRefresh?: boolean;
  instructions?: string;
  language: string;
  selectedBranch?: string;
  selectedFiles: string[];
  userId: number;
};

export const analyzeRepoTask = task({
  id: "analyze-repo",
  machine: { preset: "medium-1x" },

  maxDuration: 60 * 20,
  queue: {
    concurrencyLimit: 2,
  },

  retry: {
    factor: 2,
    maxAttempts: 2,
    maxTimeoutInMs: 60_000,
    minTimeoutInMs: 5000,
    randomize: true,
  },

  run: async (payload: TaskPayload) => {
    const {
      analysisId,
      docTypes,
      forceRefresh,
      instructions,
      language,
      selectedBranch,
      selectedFiles,
      userId,
    } = payload;

    const tempClonePath = join(os.tmpdir(), `doxynix-clone-${analysisId}`);
    const channelName = REALTIME_CONFIG.channels.user(userId);

    try {
      await taskLogger.milestone({ analysisId, msg: "Initializing analysis engine", percent: 5 });
      const { currentSha, repo, token } = await getAnalysisContext(
        analysisId,
        userId,
        forceRefresh
      );

      if (repo == null) {
        taskLogger.finalize("Current commit SHA matches last analysis. Skipping re-run.");
        return { reason: "SHA_MATCH", skipped: true };
      }

      await taskLogger.milestone({ analysisId, msg: "Fetching repository metadata", percent: 10 });
      const { busFactor, rawContributors } = await calculateBusFactor(repo, userId, prisma);

      await taskLogger.milestone({ analysisId, msg: "Cloning repository to worker", percent: 20 });
      await cloneRepository(repo, token, tempClonePath, selectedBranch);

      await taskLogger.milestone({
        analysisId,
        msg: "Reading and filtering source files",
        percent: 30,
      });
      const validFiles = await readAndFilterFiles(tempClonePath, selectedFiles);
      taskLogger.info(`Successfully indexed ${validFiles.length} files for analysis`);

      await taskLogger.milestone({ analysisId, msg: "Running deep static analysis", percent: 45 });
      const { evidence, metrics: hardMetricsCore } = await analyzeRepository(validFiles);

      taskLogger.info("Computing Git churn and change coupling...");
      const churnHotspots = await computeGitChurnHotspots(
        tempClonePath,
        validFiles.map((f) => f.path)
      );

      const changeCoupling = await computeChangeCoupling(
        tempClonePath,
        validFiles.map((f) => f.path)
      );

      const hardMetrics: RepoMetrics = { ...hardMetricsCore, changeCoupling, churnHotspots };
      const teamRoles = calculateTeamRoles(rawContributors);

      const { facts: repositoryFacts, findings: repositoryFindings } = buildRepositoryArtifacts({
        busFactor,
        evidence,
        metrics: hardMetrics,
        teamRoles,
      });

      await taskLogger.milestone({
        analysisId,
        msg: "Invoking AI Multi-Agent Pipeline",
        percent: 65,
      });
      const aiResult = await runAiPipeline(
        validFiles,
        repositoryFacts,
        repositoryFindings,
        evidence,
        hardMetrics,
        instructions,
        analysisId,
        language,
        userId,
        repo.publicId,
        selectedBranch ?? repo.defaultBranch
      );

      await taskLogger.milestone({
        analysisId,
        msg: "Generating technical documentation",
        percent: 85,
      });
      const {
        generatedApiMarkdown,
        generatedArchitecture,
        generatedChangelog,
        generatedContributing,
        generatedReadme,
        swaggerYaml,
      } = await generateDeepDocs(
        validFiles,
        aiResult,
        evidence,
        hardMetrics,
        analysisId,
        docTypes,
        repo,
        userId,
        language
      );

      aiResult.swaggerYaml = swaggerYaml;

      const generatedDocsData = {
        generatedApiMarkdown,
        generatedArchitecture,
        generatedChangelog,
        generatedContributing,
        generatedReadme,
        swaggerYaml,
      };

      // void dumpDebug("documentation-input-model", {
      //   analysisSummary: {
      //     executive_summary: aiResult.executive_summary,
      //     findings: aiResult.findings ?? [],
      //     onboarding_guide: aiResult.onboarding_guide,
      //     repository_facts: aiResult.repository_facts ?? [],
      //     sections: aiResult.sections,
      //   },
      //   model: documentationInput,
      //   source: "post-doc-generation",
      // });
      // void dumpDebug(
      //   "quality-matrix",
      //   buildEvaluationSnapshot({
      //     documentationInput,
      //     evidence,
      //     generatedDocs: aiResult,
      //     metrics: hardMetrics,
      //     repository: `${repo.owner}/${repo.name}`,
      //     repositoryFacts,
      //     repositoryFindings,
      //   })
      // );

      await taskLogger.milestone({
        analysisId,
        msg: "Persisting results to database",
        percent: 95,
      });
      await repoAnalysisService.saveResults({
        aiResult,
        analysisId,
        busFactor,
        channelName,
        currentSha,
        generatedDocsData,
        hardMetrics,
        rawContributors,
        repo,
        repositoryFacts,
        repositoryFindings,
        userId,
      });

      await taskLogger.finalize(analysisId, Status.DONE);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      taskLogger.error(`Analysis failed: ${errorMessage}`);
      await taskLogger.finalize(analysisId, Status.FAILED);

      logger.error({ msg: `Repo analyze failed: ${errorMessage}`, error });

      await handleError(error, analysisId, channelName, tempClonePath);
      throw error;
    } finally {
      taskLogger.log("Cleaning up...");
      try {
        await cleanup(tempClonePath);
      } catch (cleanupError) {
        logger.error({ cleanupError, msg: "Failed to clean up clone path", tempClonePath });
      }
    }
  },
});
