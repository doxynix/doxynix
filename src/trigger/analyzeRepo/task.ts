import os from "node:os";
import path from "node:path";
import { Status, type DocType } from "@prisma/client";
import { task } from "@trigger.dev/sdk/v3";

import type { RepoStatus } from "@/shared/api/trpc";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { prisma } from "@/server/db/db";
import { realtimeServer } from "@/server/lib/realtime";
import { logger } from "@/server/logger/logger";

import { generateDeepDocs, runAiPipeline } from "./ai-pipeline";
import { cloneRepository, getAnalysisContext } from "./git";
import { calculateBusFactor, saveResults } from "./save-results";
import { cleanup, handleError, readAndFilterFiles } from "./utils";

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

type StatusUpdater = (msg: string, percent: number, status?: RepoStatus) => Promise<void>;

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
      const busFactor = await calculateBusFactor(repo, userId);

      await updateStatus("Cloning repository...", 20);
      await cloneRepository(repo, token, tempClonePath, selectedBranch);

      await updateStatus(`Reading ${selectedFiles.length} files...`, 35);
      const validFiles = await readAndFilterFiles(tempClonePath, selectedFiles);

      const aiResult = await runAiPipeline(
        validFiles,
        instructions,
        updateStatus,
        analysisId,
        language
      );
      await updateStatus("Generating Deep Documentation (Step 3/3)...", 85);
      const { apiDoc, architecture, changelog, contributing, readme, swaggerYaml } =
        await generateDeepDocs(validFiles, aiResult, analysisId, docTypes, repo, userId, language);

      aiResult.generatedReadme = readme;
      aiResult.generatedApiMarkdown = apiDoc;
      aiResult.generatedContributing = contributing;
      aiResult.swaggerYaml = swaggerYaml;
      aiResult.generatedChangelog = changelog;
      aiResult.generatedArchitecture = architecture;

      await updateStatus("Finalizing and saving results...", 90);
      await saveResults({
        aiResult,
        analysisId,
        busFactor,
        channelName,
        currentSha,
        repo,
        userId,
        validFiles,
      });

      await cleanup(tempClonePath);
      await updateStatus("Analysis Complete", 100, Status.DONE);
    } catch (error: unknown) {
      await handleError(error, analysisId, channelName, tempClonePath);
      throw error;
    }
  },
});
