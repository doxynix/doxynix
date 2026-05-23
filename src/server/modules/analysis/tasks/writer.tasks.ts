import { queue, task } from "@trigger.dev/sdk";

import { runWriterWithLimiter, type WriterInput } from "../ai/writer-runner";
import {
  executeApiWriter,
  executeArchitectureWriter,
  executeChangelogWriter,
  executeContributingWriter,
  executeReadmeWriter,
} from "../ai/writer-tasks";

export const llmWriterQueue = queue({
  concurrencyLimit: 1,
  name: "llm-writer-queue",
});

export const readmeTask = task({
  id: "write-readme",
  queue: llmWriterQueue,
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
  queue: llmWriterQueue,
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
  queue: llmWriterQueue,
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
  queue: llmWriterQueue,
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
  queue: llmWriterQueue,
  run: async (i: {
    analysisId: string;
    analysisResult: any;
    language: string;
    repo: any;
    userId: number;
  }) => {
    return runWriterWithLimiter(
      "changelog",
      {
        allowedPaths: "",
        analysisId: i.analysisId,
        branch: i.repo.defaultBranch,
        context: "",
        engineeringDossierPayload: "",
        language: i.language,
        payload: "",
        repoId: i.repo.publicId,
        selectedTokens: 25_000,
        userId: i.userId,
      },
      () => executeChangelogWriter(i.analysisId, i.analysisResult, i.userId, i.repo, i.language)
    );
  },
});
