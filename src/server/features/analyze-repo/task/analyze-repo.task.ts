import os from "node:os";
import { Status, type DocType } from "@prisma/client";
import { task } from "@trigger.dev/sdk";
import { join } from "pathe";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import { buildEvaluationSnapshot } from "@/server/shared/engine/evaluation/quality-matrix";
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
import { dumpDebug } from "@/server/shared/lib/debug-logger";
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
      taskLogger.log("Initializing engine...");
      const { currentSha, repo, token } = await getAnalysisContext(
        analysisId,
        userId,
        forceRefresh
      );

      if (repo == null) {
        taskLogger.log("No changes detected");
        return { reason: "SHA_MATCH", skipped: true };
      }

      taskLogger.log("Calculating Bus Factor...");
      const { busFactor, rawContributors } = await calculateBusFactor(repo, userId, prisma);

      taskLogger.log("Cloning repository...");
      await cloneRepository(repo, token, tempClonePath, selectedBranch);

      taskLogger.log(`Target path: ${tempClonePath}`);

      taskLogger.log(`Reading ${selectedFiles.length} files...`);
      const validFiles = await readAndFilterFiles(tempClonePath, selectedFiles);

      const { evidence, metrics: hardMetricsCore } = await analyzeRepository(validFiles);

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

      aiResult.generatedReadme = generatedReadme;
      aiResult.generatedApiMarkdown = generatedApiMarkdown;
      aiResult.generatedContributing = generatedContributing;
      aiResult.swaggerYaml = swaggerYaml;
      aiResult.generatedChangelog = generatedChangelog;
      aiResult.generatedArchitecture = generatedArchitecture;
      const documentationInput = buildDocumentationInputModel(evidence, hardMetrics);
      hardMetrics.documentationInput = documentationInput;
      void dumpDebug("documentation-input-model", {
        analysisSummary: {
          executive_summary: aiResult.executive_summary,
          findings: aiResult.findings ?? [],
          onboarding_guide: aiResult.onboarding_guide,
          repository_facts: aiResult.repository_facts ?? [],
          sections: aiResult.sections,
        },
        model: documentationInput,
        source: "post-doc-generation",
      });
      void dumpDebug(
        "quality-matrix",
        buildEvaluationSnapshot({
          documentationInput,
          evidence,
          generatedDocs: aiResult,
          metrics: hardMetrics,
          repository: `${repo.owner}/${repo.name}`,
          repositoryFacts,
          repositoryFindings,
        })
      );

      taskLogger.log("Saving results...");
      await repoAnalysisService.saveResults({
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
      });

      await cleanup(tempClonePath);
      await taskLogger.finalize(analysisId, Status.DONE);
      return { success: true };
    } catch (error: unknown) {
      await taskLogger.finalize(analysisId, Status.FAILED);
      await handleError(error, analysisId, channelName, tempClonePath);
      throw error;
    }
  },
});
