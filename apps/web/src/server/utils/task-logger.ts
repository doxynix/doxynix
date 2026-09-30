import { metadata } from "@trigger.dev/sdk";

import { TRIGGER_CONFIG } from "@/shared/config/trigger";

import { appLogger } from "@/server/core/app-logger";

type LogLevel = "error" | "info" | "success" | "warn";

function safeMetadata(action: () => void) {
  try {
    action();
  } catch (error) {
    appLogger.debug({ error, msg: "Trigger metadata unavailable; skipping realtime update" });
  }
}

export function currentTaskMetadata(): Record<string, unknown> | undefined {
  try {
    return metadata.current();
  } catch (error) {
    appLogger.debug({ error, msg: "Trigger metadata unavailable; reading empty metadata" });
    return undefined;
  }
}

export const taskLogger = {
  error(msg: string) {
    this.log(msg, "error");
  },

  info(msg: string) {
    this.log(msg, "info");
  },

  // Real-time only; persisted to the DB by the caller that owns the record.
  log(msg: string, level: LogLevel = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const line = `${level}:::${timestamp}:::${msg}`;

    appLogger.info({ msg: `[${level.toUpperCase()}] [${timestamp}] ${msg}` });

    safeMetadata(() => metadata.append(TRIGGER_CONFIG.metadataKeys.taskLogs, line));
  },

  setProgress(percent: number) {
    safeMetadata(() => metadata.set(TRIGGER_CONFIG.metadataKeys.progress, percent));
  },

  setStatusMessage(msg: string) {
    safeMetadata(() => metadata.set(TRIGGER_CONFIG.metadataKeys.statusMessage, msg));
  },

  success(msg: string) {
    this.log(msg, "success");
  },

  warn(msg: string) {
    this.log(msg, "warn");
  },
};
