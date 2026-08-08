import os from "node:os";
import { Status, type DocType } from "@prisma/client";
import { task } from "@trigger.dev/sdk";
import { join } from "pathe";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { cloneRepository, getAnalysisContext } from "@/server/core/github/git";
import { calculateBusFactor } from "@/server/core/github/github-api";
import { taskLogger } from "@/server/modules/analysis/logic/task-logger";
import { TASK_CONFIGS } from "@/server/utils/task-config";
import { cleanup, handleError, readAndFilterFiles } from "@/server/utils/utils";

import { generateDeepDocs, runAiPipeline } from "../ai/ai-pipeline";
import { repoAnalysisService } from "../analysis.service";
import type { RepoMetrics } from "../engine/core/metrics.types";
import { analyzeRepository } from "../engine/metrics/code-metrics";
import {
  calculateTeamRoles,
  computeChangeCoupling,
  computeGitChurnHotspots,
} from "../engine/metrics/common-metrics";
import { buildRepositoryArtifacts } from "../engine/pipeline/artifacts";

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
  ...TASK_CONFIGS.analyzeRepo,
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
      await taskLogger.milestone({
        analysisId,
        msg: "Initializing analysis engine",
        percent: 5,
        userId,
      });
      const { currentSha, repo, token } = await getAnalysisContext(
        analysisId,
        userId,
        forceRefresh
      );

      if (repo == null) {
        await taskLogger.finalize(
          analysisId,
          Status.DONE,
          "Current commit SHA matches last analysis. Skipping re-run."
        );
        return { reason: "SHA_MATCH", skipped: true };
      }

      await taskLogger.milestone({
        analysisId,
        msg: "Fetching repository metadata",
        percent: 10,
        userId,
      });
      const { busFactor, rawContributors } = await calculateBusFactor(repo, userId, prisma);

      await taskLogger.milestone({
        analysisId,
        msg: "Cloning repository to worker",
        percent: 20,
        userId,
      });
      await cloneRepository(repo, token, tempClonePath, selectedBranch);

      await taskLogger.milestone({
        analysisId,
        msg: "Reading and filtering source files",
        percent: 30,
        userId,
      });
      const validFiles = await readAndFilterFiles(tempClonePath, selectedFiles);
      taskLogger.info(`Successfully indexed ${validFiles.length} files for analysis`);

      await taskLogger.milestone({
        analysisId,
        msg: "Running deep static analysis",
        percent: 45,
        userId,
      });
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
        userId,
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
        userId,
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

      await taskLogger.milestone({
        analysisId,
        msg: "Persisting results to database",
        percent: 95,
        userId,
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

      await taskLogger.finalize(analysisId, Status.DONE, "Analysis completed successfully");
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      taskLogger.error(`Analysis failed: ${errorMessage}`);
      await taskLogger.finalize(analysisId, Status.FAILED, errorMessage);

      appLogger.error({ error, msg: `Repo analyze failed: ${errorMessage}` });

      await handleError(error, analysisId, channelName, tempClonePath);
      throw error;
    } finally {
      taskLogger.log("Cleaning up...");
      try {
        await cleanup(tempClonePath);
      } catch (cleanupError) {
        appLogger.error({ cleanupError, msg: "Failed to clean up clone path", tempClonePath });
      }
    }
  },
});
