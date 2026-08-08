import { queue, type task } from "@trigger.dev/sdk";

type TriggerTaskOptions = Parameters<typeof task>[0];

export type TaskInfraConfig = Omit<TriggerTaskOptions, "id" | "run">;

/**
 * Единая разделяемая очередь для всех AI-райтеров документации (Readme, API, и т.д.).
 * Устанавливает конкурентность на уровне максимум 2 задач на один ключ (пользователя).
 */
export const writersQueue = queue({
  concurrencyLimit: 2,
  name: "ai-documentation-writers",
});

export const TASK_CONFIGS = {
  agentGithubReply: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 10, // TIME: 10 минут
    retry: {
      maxAttempts: 1,
    },
  },

  // Анализ изменений (диффа) в рамках Pull Request
  analyzePr: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 5, // TIME: 5 минут
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

  // Полный статический анализ и построение графа зависимостей
  analyzeRepo: {
    machine: { preset: "medium-1x" },
    maxDuration: 60 * 60, // TIME: 60 минут
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

  // Экспресс-аудит безопасности и качества одного файла
  analyzeSingleFile: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 5, // TIME: 5 минут
    retry: {
      maxAttempts: 1,
    },
  },

  // Ежедневный регламент обслуживания СУБД (очистка сессий, токенов)
  dailyDatabaseMaintenance: {
    machine: { preset: "micro" },
    maxDuration: 60 * 5, // TIME: 5 минут
    retry: {
      factor: 2,
      maxAttempts: 3,
      minTimeoutInMs: 10_000,
      outOfMemory: {
        machine: "small-1x",
      },
    },
  },

  // Документирование исходного кода одного файла
  documentSingleFile: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 5, // TIME: 5 минут
    retry: {
      maxAttempts: 1,
    },
  },

  // Генерация автоматических исправлений кода (AI Fix)
  generateFix: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 15, // TIME: 15 минут
    retry: {
      maxAttempts: 1,
    },
  },

  // AI-райтеры для комплексной документации репозитория
  writers: {
    machine: { preset: "small-2x" },
    maxDuration: 60 * 15, // TIME: 15 минут
    queue: writersQueue,
    retry: {
      maxAttempts: 1,
    },
  },
} as const satisfies Record<string, TaskInfraConfig>;
