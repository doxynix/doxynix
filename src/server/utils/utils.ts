import fs from "node:fs/promises";
import { compact } from "es-toolkit";
import fg from "fast-glob";
import { isBinaryFile } from "isbinaryfile";
import { join, normalize } from "pathe";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { realtimeServer } from "@/server/core/realtime";
import { ProjectPolicy } from "@/server/modules/analysis/engine/core/project-policy";

import { taskLogger } from "./task-logger";

export async function handleError(
  error: unknown,
  analysisId: string,
  channelName: string,
  tempPath: string
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  appLogger.error({
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
  taskLogger.info(`File System: Scanning directory for ${selectedFiles.length} patterns...`);

  const resolvedBase = await fs.realpath(basePath);

  const entries = await fg(selectedFiles, {
    absolute: false,
    cwd: resolvedBase,
    dot: true,
    followSymbolicLinks: false,
    onlyFiles: true,
  });

  if (entries.length === 0) {
    taskLogger.error("File System: No valid files found matching your patterns");
    throw new Error("No valid files found to analyze in the specified path");
  }

  let binaryCount = 0;
  let sensitiveCount = 0;

  const filePromises = entries.map(async (filePath) => {
    taskLogger.log(`Reading: ${filePath}`);

    if (ProjectPolicy.isSensitive(filePath)) {
      sensitiveCount++;
      taskLogger.log(`Skipping sensitive file: ${filePath}`);

      appLogger.warn({
        filePath,
        msg: "Skipping sensitive file from analysis context",
      });
      return null;
    }

    const fullPath = join(resolvedBase, filePath);
    const realFullPath = await fs.realpath(fullPath).catch(() => null);

    if (realFullPath == null || !realFullPath.startsWith(resolvedBase)) {
      appLogger.warn({
        filePath,
        msg: "Security: rejected path outside base directory",
      });
      return null;
    }

    try {
      const buffer = await fs.readFile(realFullPath);
      const isBinary = await isBinaryFile(buffer);

      if (isBinary) {
        binaryCount++;
        return null;
      }

      return { content: buffer.toString("utf-8"), path: filePath };
    } catch (error) {
      appLogger.warn({
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

  if (sensitiveCount > 0) taskLogger.warn(`File System: Skipped ${sensitiveCount} sensitive files`);
  if (binaryCount > 0) taskLogger.info(`File System: Ignored ${binaryCount} binary/asset files`);

  if (validFiles.length === 0) throw new Error("No valid text files found to analyze");
  return validFiles;
}
