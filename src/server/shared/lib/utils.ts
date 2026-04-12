import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { isBinaryFile } from "isbinaryfile";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { ProjectPolicy } from "../engine/core/project-policy";
import { prisma } from "../infrastructure/db";
import { logger } from "../infrastructure/logger";
import { realtimeServer } from "../infrastructure/realtime";

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

  await realtimeServer.channels
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
    if (ProjectPolicy.isSensitive(filePath)) {
      logger.warn({
        filePath,
        msg: "Skipping sensitive file from analysis context",
      });
      return null;
    }

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
    } catch (error) {
      logger.warn({
        error:
          error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
        filePath,
        msg: "Failed to read file",
      });
      return null;
    }
  });

  const settledFiles = await Promise.all(filePromises);

  const validFiles = settledFiles.filter((f): f is { content: string; path: string } => f != null);

  if (validFiles.length === 0) throw new Error("No valid text files found to analyze");
  return validFiles;
}
