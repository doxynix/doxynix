import { task } from "@trigger.dev/sdk";

import { runWriterWithLimiter, type WriterInput } from "../ai/writer-runner";
import {
  executeApiWriter,
  executeArchitectureWriter,
  executeChangelogWriter,
  executeContributingWriter,
  executeReadmeWriter,
} from "../ai/writer-tasks";

export const readmeTask = task({
  id: "write-readme",
  run: async (i: WriterInput) =>
    runWriterWithLimiter("readme", i, () =>
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
    runWriterWithLimiter("api", i, () =>
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
    runWriterWithLimiter("architecture", i, () =>
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
    runWriterWithLimiter("contributing", i, () =>
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
