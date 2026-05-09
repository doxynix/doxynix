import { Status } from "@prisma/client";
import { metadata } from "@trigger.dev/sdk/v3";

import { prisma } from "../infrastructure/db";
import { logger as internalLogger } from "../infrastructure/logger";

let lastLogTime = 0;
const LOG_THROTTLE_MS = 1000;

/**
 * Утилита для управления прогрессом и логами таска.
 * Разделяет real-time поток (metadata) и вечное хранение (DB).
 */
export const taskLogger = {
  /**
   * Финальный синк. Вызывается один раз в конце.
   * Собирает ВСЕ логи из метаданных и кладет в БД на вечное хранение.
   */
  async finalize(analysisId: string, status: Status = Status.DONE) {
    const currentMetadata = metadata.current();
    const allLogs = (currentMetadata?.task_logs as string[]).join("\n");

    await prisma.analysis.update({
      data: {
        logs: allLogs,
        progress: 100,
        status,
      },
      where: { publicId: analysisId },
    });

    this.log(`Analysis finalized with status: ${status}`);
  },

  /**
   * Гранулярный лог. Только для real-time отображения.
   * Не делает запросов в БД.
   */
  log: (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const line = `[${timestamp}] ${msg}`;
    const now = Date.now();

    internalLogger.info({ msg: line });

    if (now - lastLogTime > LOG_THROTTLE_MS) {
      const timestamp = new Date().toLocaleTimeString();
      metadata.append("task_logs", `[${timestamp}] ${msg}`);
      lastLogTime = now;
    }
  },

  /**
   * Обновление статуса этапа.
   * Пишет в метаданные И в базу данных (так как это важная точка).
   */
  async milestone(params: { analysisId: string; msg: string; percent: number; status?: Status }) {
    const { analysisId, msg, percent, status = Status.PENDING } = params;

    this.log(`MILESTONE: ${msg} (${percent}%)`);

    metadata.set("status_message", msg);
    metadata.set("progress", percent);

    await prisma.analysis.update({
      data: {
        message: msg,
        progress: percent,
        status,
      },
      where: { publicId: analysisId },
    });
  },
};
