import { task } from "@trigger.dev/sdk";

import { appLogger } from "@/server/shared/infrastructure/app-logger";
import { llmLimiter } from "@/server/shared/lib/llm-limiter";

import {
  executeApiWriter,
  executeArchitectureWriter,
  executeChangelogWriter,
  executeContributingWriter,
  executeReadmeWriter,
  type WriterName,
  type WriterResult,
} from "../model/writers/writer-tasks";

interface WriterInput {
  allowedPaths: string;
  analysisId: string;
  branch: string;
  context: string;
  engineeringDossierPayload: string;
  language: string;
  payload: string;
  repoId: string;
  selectedTokens: number;
  userId: number;
}

async function runWithLimiter(
  name: WriterName,
  input: WriterInput,
  taskFn: () => Promise<WriterResult>
): Promise<WriterResult> {
  const { analysisId, selectedTokens } = input;
  const estimatedWeight = Math.ceil(selectedTokens * 1.3) + 15_000;

  appLogger.info({
    analysisId,
    calculatedWeight: estimatedWeight,
    msg: `Scheduling distributed task ${name.toUpperCase()}`,
    tokens: selectedTokens,
  });

  try {
    return await llmLimiter.schedule(
      {
        id: `${analysisId}-${name}`,
        weight: estimatedWeight,
      },
      taskFn
    );
  } catch (error) {
    appLogger.error({ analysisId, error, msg: `Writer ${name} failed in distributed queue` });
    return {
      error: "Queue overflow or API error",
      name,
      status: "failed",
    };
  }
}

export const readmeTask = task({
  id: "write-readme",
  run: async (i: WriterInput) =>
    runWithLimiter("readme", i, () =>
      executeReadmeWriter(
        i.analysisId,
        i.payload,
        i.engineeringDossierPayload,
        i.context,
        i.allowedPaths,
        i.language,
        i.repoId,
        i.userId,
        i.branch
      )
    ),
});

export const apiTask = task({
  id: "write-api",
  run: async (i: WriterInput) =>
    runWithLimiter("api", i, () =>
      executeApiWriter(
        i.analysisId,
        i.payload,
        i.engineeringDossierPayload,
        i.context,
        i.allowedPaths,
        i.language,
        i.repoId,
        i.userId,
        i.branch
      )
    ),
});

export const architectureTask = task({
  id: "write-architecture",
  run: async (
    i: WriterInput & { moduleContext: string; onboardingPayload: string; risksPayload: string }
  ) =>
    runWithLimiter("architecture", i, () =>
      executeArchitectureWriter(
        i.analysisId,
        i.payload,
        i.risksPayload,
        i.onboardingPayload,
        i.moduleContext,
        i.engineeringDossierPayload,
        i.context,
        i.allowedPaths,
        i.language,
        i.repoId,
        i.userId,
        i.branch
      )
    ),
});

export const contributingTask = task({
  id: "write-contributing",
  run: async (i: WriterInput) =>
    runWithLimiter("contributing", i, () =>
      executeContributingWriter(
        i.analysisId,
        i.payload,
        i.engineeringDossierPayload,
        i.context,
        i.allowedPaths,
        i.language,
        i.repoId,
        i.userId,
        i.branch
      )
    ),
});

export const changelogTask = task({
  id: "write-changelog",
  run: async (i: {
    analysisId: string;
    analysisResult: any;
    language: string;
    repo: any;
    userId: number;
  }) => executeChangelogWriter(i.analysisId, i.analysisResult, i.userId, i.repo, i.language),
});

export const docsWriterTask = task({
  id: "docs-writer",
  run: async (payload: any) => {
    const { type, ...params } = payload;

    switch (type) {
      case "readme": {
        return await executeReadmeWriter(
          params.analysisId,
          params.payload,
          params.engineeringDossierPayload,
          params.context,
          params.allowedPaths,
          params.language,
          params.repoId,
          params.userId,
          params.branch
        );
      }
      case "api": {
        return await executeApiWriter(
          params.analysisId,
          params.payload,
          params.engineeringDossierPayload,
          params.context,
          params.allowedPaths,
          params.language,
          params.repoId,
          params.userId,
          params.branch
        );
      }
      case "architecture": {
        return await executeArchitectureWriter(
          params.analysisId,
          params.payload,
          params.risksPayload,
          params.onboardingPayload,
          params.moduleContext,
          params.engineeringDossierPayload,
          params.context,
          params.allowedPaths,
          params.language,
          params.repoId,
          params.userId,
          params.branch
        );
      }
      case "contributing": {
        return await executeContributingWriter(
          params.analysisId,
          params.payload,
          params.engineeringDossierPayload,
          params.context,
          params.allowedPaths,
          params.language,
          params.repoId,
          params.userId,
          params.branch
        );
      }
      case "changelog": {
        return await executeChangelogWriter(
          params.analysisId,
          params.analysisResult,
          params.userId,
          params.repo,
          params.language
        );
      }
      default: {
        throw new Error(`Unknown writer type: ${type}`);
      }
    }
  },
});
