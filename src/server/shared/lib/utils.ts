import fs from "node:fs/promises";
import path from "node:path";
import { compact } from "es-toolkit";
import fg from "fast-glob";
import { isBinaryFile } from "isbinaryfile";
import { normalize } from "pathe";

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
  const path = normalize(dirPath);
  await fs.rm(path, { force: true, recursive: true });
}

export async function readAndFilterFiles(basePath: string, selectedFiles: string[]) {
  const resolvedBase = await fs.realpath(basePath);

  const entries = await fg(selectedFiles, {
    absolute: false,
    cwd: resolvedBase,
    dot: true,
    followSymbolicLinks: false,
    onlyFiles: true,
  });

  if (entries.length === 0) {
    throw new Error("No valid files found to analyze in the specified path");
  }

  const filePromises = entries.map(async (filePath) => {
    if (ProjectPolicy.isSensitive(filePath)) {
      logger.warn({
        filePath,
        msg: "Skipping sensitive file from analysis context",
      });
      return null;
    }

    const fullPath = path.join(resolvedBase, filePath);
    const realFullPath = await fs.realpath(fullPath).catch(() => null);

    if (realFullPath == null || !realFullPath.startsWith(resolvedBase)) {
      logger.warn({
        filePath,
        msg: "Security: rejected path outside base directory",
      });
      return null;
    }

    try {
      const buffer = await fs.readFile(realFullPath);
      const isBinary = await isBinaryFile(buffer);

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
  const validFiles = compact(settledFiles);

  if (validFiles.length === 0) throw new Error("No valid text files found to analyze");
  return validFiles;
}
