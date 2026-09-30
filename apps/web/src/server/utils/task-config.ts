import { queue, type task } from "@trigger.dev/sdk";

type TriggerTaskOptions = Parameters<typeof task>[0];

export type TaskInfraConfig = Omit<TriggerTaskOptions, "id" | "run">;

export const writersQueue = queue({
  concurrencyLimit: 2,
  name: "ai-documentation-writers",
});

export const TASK_CONFIGS = {
  agentGithubReply: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 10, // TIME: 10 minutes
    retry: {
      maxAttempts: 1,
    },
  },

  analyzePr: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 5, // TIME: 5 minutes
    retry: {
      factor: 2,
      maxAttempts: 2,
      maxTimeoutInMs: 15_000,
      minTimeoutInMs: 2000,
      outOfMemory: {
        machine: "medium-1x",
      },
    },
  },

  analyzeRepo: {
    machine: { preset: "medium-1x" },
    maxDuration: 60 * 60, // TIME: 60 minutes
    retry: {
      factor: 2,
      maxAttempts: 2,
      maxTimeoutInMs: 60_000,
      minTimeoutInMs: 5000,
      outOfMemory: {
        machine: "large-1x",
      },
      randomize: true,
    },
  },

  analyzeSingleFile: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 5, // TIME: 5 minutes
    retry: {
      maxAttempts: 1,
    },
  },

  dailyDatabaseMaintenance: {
    machine: { preset: "micro" },
    maxDuration: 60 * 5, // TIME: 5 minutes
    retry: {
      factor: 2,
      maxAttempts: 3,
      minTimeoutInMs: 10_000,
      outOfMemory: {
        machine: "small-1x",
      },
    },
  },

  documentSingleFile: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 5, // TIME: 5 minutes
    retry: {
      maxAttempts: 1,
    },
  },

  generateFix: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 15, // TIME: 15 minutes
    retry: {
      maxAttempts: 1,
    },
  },

  writers: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 15, // TIME: 15 minutes
    queue: writersQueue,
    retry: {
      maxAttempts: 1,
    },
  },
} as const satisfies Record<string, TaskInfraConfig>;
