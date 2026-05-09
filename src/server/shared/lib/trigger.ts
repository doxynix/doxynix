/**
 * Централизованный конфиг для Trigger.dev.
 */
export const TRIGGER_CONFIG = {
  metadataKeys: {
    aiChunks: "ai_chunks",
    aiThoughts: "ai_thoughts",
    progress: "progress",
    statusMessage: "status_message",
    taskLogs: "task_logs",
  },
} as const;

export type TriggerMetadataKey =
  (typeof TRIGGER_CONFIG.metadataKeys)[keyof typeof TRIGGER_CONFIG.metadataKeys];
