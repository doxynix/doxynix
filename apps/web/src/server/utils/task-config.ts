import { queue, type task } from "@trigger.dev/sdk";

type TriggerTaskOptions = Parameters<typeof task>[0];

export type TaskInfraConfig = Omit<TriggerTaskOptions, "id" | "run">;

/**
 * Shared queue for all AI documentation writers (README, API, etc.).
 * Sets concurrency to at most 2 tasks per key (user).
 */
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

  // Analysis of changes (diff) in a Pull Request
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

  // Full static analysis and dependency graph construction
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

  // Express security and quality audit of a single file
  analyzeSingleFile: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 5, // TIME: 5 minutes
    retry: {
      maxAttempts: 1,
    },
  },

  // Daily database maintenance routine (session, token cleanup)
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

  // Documentation of a single file's source code
  documentSingleFile: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 5, // TIME: 5 minutes
    retry: {
      maxAttempts: 1,
    },
  },

  // Generation of automatic code fixes (AI Fix)
  generateFix: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 15, // TIME: 15 minutes
    retry: {
      maxAttempts: 1,
    },
  },

  // AI writers for comprehensive repository documentation
  writers: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 15, // TIME: 15 minutes
    queue: writersQueue,
    retry: {
      maxAttempts: 1,
    },
  },
} as const satisfies Record<string, TaskInfraConfig>;
