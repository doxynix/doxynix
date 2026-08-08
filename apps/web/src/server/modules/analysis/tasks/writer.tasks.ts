import { task } from "@trigger.dev/sdk";

import { TASK_CONFIGS } from "@/server/utils/task-config";

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
  ...TASK_CONFIGS.writers,
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
  ...TASK_CONFIGS.writers,
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
  ...TASK_CONFIGS.writers,
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
  ...TASK_CONFIGS.writers,
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
  ...TASK_CONFIGS.writers,
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
