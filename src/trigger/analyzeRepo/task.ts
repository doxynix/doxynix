import os from "os";
import path from "path";
import { task } from "@trigger.dev/sdk/v3";

import { prisma } from "@/shared/api/db/db";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";
import { logger } from "@/shared/lib/logger";

import { DocTypeType } from "@/generated/zod/inputTypeSchemas/DocTypeSchema";
import StatusSchema, { StatusType } from "@/generated/zod/inputTypeSchemas/StatusSchema";
import { realtimeServer } from "@/server/lib/realtime";
import { generateDeepDocs, runAiPipeline } from "./ai-pipeline";
import { cloneRepository, getAnalysisContext } from "./git";
import { calculateBusFactor, saveResults } from "./save-results";
import { cleanup, handleError, readAndFilterFiles } from "./utils";

type TaskPayload = {
  analysisId: string;
  userId: number;
  selectedFiles: string[];
  selectedBranch?: string;
  instructions?: string;
  docTypes: DocTypeType[];
  forceRefresh?: boolean;
  language: string;
};

type StatusUpdater = (msg: string, percent: number, status?: StatusType) => Promise<void>;

export const analyzeRepoTask = task({
  id: "analyze-repo",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    factor: 2,
    randomize: true,
  },

  machine: { preset: "medium-1x" },
  queue: {
    concurrencyLimit: 2,
  },

  maxDuration: 60 * 20,

  run: async (payload: TaskPayload) => {
    const {
      analysisId,
      userId,
      selectedFiles,
      instructions,
      forceRefresh,
      docTypes,
      language,
      selectedBranch,
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
        msg: `Analysis progress`,
        analysisId,
        percent,
        status,
        detail: msg,
      });

      await Promise.all([
        prisma.analysis.update({
          where: { publicId: analysisId },
          data: { status, progress: percent, message: msg, logs: currentLogs },
        }),
        realtimeServer.channels
          .get(channelName)
          ?.publish(REALTIME_CONFIG.events.user.analysisProgress, {
            analysisId,
            status,
            progress: percent,
            message: msg,
            log: logLine,
          }),
      ]);
    };

    try {
      await updateStatus("Initializing...", 5);
      const { repo, token, currentSha } = await getAnalysisContext(
        analysisId,
        userId,
        forceRefresh
      );

      if (!repo) {
        await updateStatus("No changes detected. Skipping...", 100, StatusSchema.enum.DONE);
        return { skipped: true, reason: "SHA_MATCH" };
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
      const { readme, apiDoc, swaggerYaml, contributing, changelog, architecture } =
        await generateDeepDocs(validFiles, aiResult, analysisId, docTypes, repo, userId, language);

      if (readme !== null) aiResult.generatedReadme = readme;
      if (apiDoc !== null) aiResult.generatedApiMarkdown = apiDoc;
      if (contributing !== null) aiResult.generatedContributing = contributing;
      if (swaggerYaml !== null) aiResult.swaggerYaml = swaggerYaml;
      if (changelog !== null) aiResult.generatedChangelog = changelog;
      if (architecture !== null) aiResult.generatedArchitecture = architecture;

      await updateStatus("Finalizing and saving results...", 90);
      await saveResults({
        analysisId,
        repo,
        userId,
        validFiles,
        aiResult,
        busFactor,
        currentSha,
        channelName,
      });

      await cleanup(tempClonePath);
      await updateStatus("Analysis Complete", 100, StatusSchema.enum.DONE);
    } catch (error: unknown) {
      await handleError(error, analysisId, channelName, tempClonePath);
      throw error;
    }
  },
});
