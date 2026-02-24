import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { isBinaryFile } from "isbinaryfile";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { prisma } from "@/server/db/db";
import { realtimeServer } from "@/server/lib/realtime";
import { logger } from "@/server/logger/logger";

export async function handleError(
  error: unknown,
  analysisId: string,
  channelName: string,
  tempPath: string
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error({
    analysisId,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    msg: "TASK_ERROR",
  });

  await cleanup(tempPath);

  await prisma.analysis.update({
    data: {
      error: message,
      message: "Analysis failed",
      status: "FAILED",
    },
    where: { publicId: analysisId },
  });

  void realtimeServer.channels
    .get(channelName)
    .publish(REALTIME_CONFIG.events.user.analysisProgress, {
      analysisId,
      message,
      status: "FAILED",
    });
}

export async function cleanup(dirPath: string) {
  if (existsSync(dirPath)) {
    logger.info({ msg: "Removing temp clone path", path: dirPath });
    await fs.rm(dirPath, { force: true, recursive: true });
  } else {
    logger.debug({ msg: "Temp clone path not present", path: dirPath });
  }
}

export async function readAndFilterFiles(basePath: string, selectedFiles: string[]) {
  const resolvedBase = await fs.realpath(basePath);

  const filePromises = selectedFiles.map(async (filePath) => {
    const fullPath = path.resolve(basePath, filePath);

    try {
      const realPath = await fs.realpath(fullPath);

      const relative = path.relative(resolvedBase, realPath);
      const isOutside = relative.startsWith("..") || path.isAbsolute(relative);

      if (isOutside) {
        logger.warn({
          filePath,
          msg: "Security: attempt to read file outside of basePath",
          resolvedPath: realPath,
        });
        return null;
      }

      const stat = await fs.lstat(realPath);
      if (!stat.isFile()) {
        return null;
      }

      const buffer = await fs.readFile(realPath);
      const isBinary = await isBinaryFile(buffer, { size: stat.size });
      if (isBinary) return null;

      return { content: buffer.toString("utf-8"), path: filePath };
    } catch (e) {
      logger.warn({
        error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
        filePath,
        msg: "Failed to read file",
      });
      return null;
    }
  });

  const validFiles = (await Promise.all(filePromises)).filter(
    (f): f is { content: string; path: string } => f != null
  );

  if (validFiles.length === 0) throw new Error("No valid text files found to analyze");
  return validFiles;
}
