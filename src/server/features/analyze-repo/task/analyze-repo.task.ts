import os from "node:os";
import path from "node:path";
import { Status, type DocType } from "@prisma/client";
import { task } from "@trigger.dev/sdk/v3";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { repoAnalysisService } from "@/server/features/analyze-repo/api/repo-analysis.service";
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
import { cloneRepository, getAnalysisContext } from "@/server/shared/infrastructure/git";
import { calculateBusFactor } from "@/server/shared/infrastructure/github/github-api";
import { logger } from "@/server/shared/infrastructure/logger";
import { realtimeServer } from "@/server/shared/infrastructure/realtime";
import { dumpDebug } from "@/server/shared/lib/debug-logger";
import { cleanup, handleError, readAndFilterFiles } from "@/server/shared/lib/utils";

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

type StatusUpdater = (msg: string, percent: number, status?: Status) => Promise<void>;

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
    maxTimeoutInMs: 60000,
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

    let currentLogs = "";
    const tempClonePath = path.join(os.tmpdir(), `doxynix-clone-${analysisId}`);
    const channelName = REALTIME_CONFIG.channels.user(userId);

    const updateStatus: StatusUpdater = async (msg, percent, status = Status.PENDING) => {
      const timestamp = new Date().toLocaleTimeString();
      const logLine = `[${timestamp}] ${msg}\n`;
      currentLogs += logLine;
      logger.info({
        analysisId,
        detail: msg,
        msg: `Analysis progress`,
        percent,
        status,
      });

      await Promise.all([
        prisma.analysis.update({
          data: { logs: currentLogs, message: msg, progress: percent, status },
          where: { publicId: analysisId },
        }),
        realtimeServer.channels
          .get(channelName)
          .publish(REALTIME_CONFIG.events.user.analysisProgress, {
            analysisId,
            log: logLine,
            message: msg,
            progress: percent,
            status,
          }),
      ]);
    };

    try {
      await updateStatus("Initializing...", 5);
      const { currentSha, repo, token } = await getAnalysisContext(
        analysisId,
        userId,
        forceRefresh
      );

      if (repo == null) {
        await updateStatus("No changes detected. Skipping...", 100, Status.DONE);
        return { reason: "SHA_MATCH", skipped: true };
      }

      await updateStatus("Calculating Bus Factor...", 15);
      const { busFactor, rawContributors } = await calculateBusFactor(repo, userId, prisma);

      await updateStatus("Cloning repository...", 20);
      await cloneRepository(repo, token, tempClonePath, selectedBranch);

      await updateStatus(`Reading ${selectedFiles.length} files...`, 35);
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
        updateStatus,
        analysisId,
        language
      );
      await updateStatus("Generating Deep Documentation (Step 3/3)...", 85);
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
      dumpDebug("documentation-input-model", {
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
      dumpDebug(
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

      await updateStatus("Finalizing and saving results...", 90);
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
      await updateStatus("Analysis Complete", 100, Status.DONE);
    } catch (error: unknown) {
      await handleError(error, analysisId, channelName, tempClonePath);
      throw error;
    }
  },
});
