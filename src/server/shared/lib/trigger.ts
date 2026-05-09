/**
 * Централизованный конфиг для Trigger.dev.
 */
export const TRIGGER_CONFIG = {
  metadataKeys: {
    progress: "progress",
    statusMessage: "status_message",
    taskLogs: "task_logs",
    aiChunks: "ai_chunks",
    aiThoughts: "ai_thoughts",
  },
} as const;

export type TriggerMetadataKey =
  (typeof TRIGGER_CONFIG.metadataKeys)[keyof typeof TRIGGER_CONFIG.metadataKeys];
