import os from "node:os";
import path from "node:path";
import { task } from "@trigger.dev/sdk/v3";

import { prisma } from "@/shared/api/db/db";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";
import { logger } from "@/shared/lib/logger";

import type { DocTypeType } from "@/generated/zod/inputTypeSchemas/DocTypeSchema";
import StatusSchema, { type StatusType } from "@/generated/zod/inputTypeSchemas/StatusSchema";
import { realtimeServer } from "@/server/lib/realtime";
import { generateDeepDocs, runAiPipeline } from "./ai-pipeline";
import { cloneRepository, getAnalysisContext } from "./git";
import { calculateBusFactor, saveResults } from "./save-results";
import { cleanup, handleError, readAndFilterFiles } from "./utils";

type TaskPayload = {
  analysisId: string;
  docTypes: DocTypeType[];
  forceRefresh?: boolean;
  instructions?: string;
  language: string;
  selectedBranch?: string;
  selectedFiles: string[];
  userId: number;
};

type StatusUpdater = (msg: string, percent: number, status?: StatusType) => Promise<void>;

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

    const updateStatus: StatusUpdater = async (
      msg,
      percent,
      status = StatusSchema.enum.PENDING
    ) => {
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
          ?.publish(REALTIME_CONFIG.events.user.analysisProgress, {
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
        await updateStatus("No changes detected. Skipping...", 100, StatusSchema.enum.DONE);
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

      if (readme != null) aiResult.generatedReadme = readme;
      if (apiDoc != null) aiResult.generatedApiMarkdown = apiDoc;
      if (contributing != null) aiResult.generatedContributing = contributing;
      if (swaggerYaml != null) aiResult.swaggerYaml = swaggerYaml;
      if (changelog != null) aiResult.generatedChangelog = changelog;
      if (architecture != null) aiResult.generatedArchitecture = architecture;

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
      await updateStatus("Analysis Complete", 100, StatusSchema.enum.DONE);
    } catch (error: unknown) {
      await handleError(error, analysisId, channelName, tempClonePath);
      throw error;
    }
  },
});
