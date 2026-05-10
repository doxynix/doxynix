import { Status } from "@prisma/client";
import { metadata } from "@trigger.dev/sdk";

import { prisma } from "@/server/core/db";

import { appLogger } from "../core/app-logger";
import { TRIGGER_CONFIG } from "../../shared/lib/trigger";

type LogLevel = "error" | "info" | "success" | "warn";

function safeMetadata(action: () => void) {
  try {
    action();
  } catch (error) {
    appLogger.debug({ error, msg: "Trigger metadata unavailable; skipping realtime update" });
  }
}

function safeCurrentMetadata() {
  try {
    return metadata.current();
  } catch (error) {
    appLogger.debug({ error, msg: "Trigger metadata unavailable; reading empty metadata" });
    return;
  }
}

/**
 * Утилита для управления прогрессом и логами таска.
 * Разделяет real-time поток (metadata) и вечное хранение (DB).
 */
export const taskLogger = {
  error(msg: string) {
    this.log(msg, "error");
  },
  /**
   * Финальный синк. Вызывается один раз в конце.
   * Собирает ВСЕ логи из метаданных и кладет в БД на вечное хранение.
   */
  async finalize(analysisId: string, status: Status = Status.DONE) {
    const currentMetadata = safeCurrentMetadata();

    const rawLogs = currentMetadata?.[TRIGGER_CONFIG.metadataKeys.taskLogs];
    const allLogs = Array.isArray(rawLogs) ? rawLogs.join("\n") : "";

    await prisma.analysis.update({
      data: {
        logs: allLogs,
        progress: 100,
        status,
      },
      where: { publicId: analysisId },
    });

    if (status === Status.DONE) {
      this.success(`Analysis finalized with status: ${status}`);
    } else {
      this.error(`Analysis finalized with status: ${status}`);
    }
  },
  /**
   * Хелперы для разных уровней логов
   */
  info(msg: string) {
    this.log(msg, "info");
  },
  /**
   * Гранулярный лог. Только для real-time отображения.
   * Формат строки: "level:::timestamp:::message"
   */
  log(msg: string, level: LogLevel = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const line = `${level}:::${timestamp}:::${msg}`;

    appLogger.info({ msg: `[${level.toUpperCase()}] [${timestamp}] ${msg}` });

    safeMetadata(() => metadata.append(TRIGGER_CONFIG.metadataKeys.taskLogs, line));
  },

  /**
   * Обновление статуса этапа.
   * Пишет в метаданные И в базу данных (так как это важная точка).
   */
  async milestone(params: { analysisId: string; msg: string; percent: number; status?: Status }) {
    const { analysisId, msg, percent, status = Status.PENDING } = params;

    this.info(`STAGE: ${msg} (${percent}%)`);

    safeMetadata(() => metadata.set(TRIGGER_CONFIG.metadataKeys.statusMessage, msg));
    safeMetadata(() => metadata.set(TRIGGER_CONFIG.metadataKeys.progress, percent));

    await prisma.analysis.update({
      data: {
        message: msg,
        progress: percent,
        status,
      },
      where: { publicId: analysisId },
    });
  },

  success(msg: string) {
    this.log(msg, "success");
  },

  warn(msg: string) {
    this.log(msg, "warn");
  },
};
