import fs from "node:fs/promises";

import { Status } from "@doxynix/shared";
import { compact } from "es-toolkit";
import fg from "fast-glob";
import { join, normalize } from "pathe";

import { REALTIME_CONFIG } from "@/shared/constants/realtime";

import { appLogger } from "@/server/core/app-logger";
import { prisma } from "@/server/core/db";
import { realtimeService } from "@/server/core/realtime";
import { ProjectPolicy } from "@/server/modules/analysis/engine/core/project-policy";

import { taskLogger } from "../modules/analysis/logic/task-logger";

const MAX_TEXT_FILE_SIZE = 10 * 1024 * 1024;

export async function handleError(
  error: unknown,
  analysisId: string,
  channelName: string,
  tempPath: string,
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
      status: Status.FAILED,
    },
    where: { publicId: analysisId },
  });

  await realtimeService.channel(channelName).publish(REALTIME_CONFIG.events.user.analysisProgress, {
    analysisId,
    message,
    status: Status.FAILED,
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

      appLogger.warn({ filePath, msg: "Skipping sensitive file from analysis context" });
      return null;
    }

    const fullPath = join(resolvedBase, filePath);
    const realFullPath = await fs.realpath(fullPath).catch(() => null);

    if (realFullPath == null || !realFullPath.startsWith(resolvedBase)) {
      appLogger.warn({ filePath, msg: "Security: rejected path outside base directory" });
      return null;
    }

    try {
      const stats = await fs.stat(realFullPath);
      if (stats.size > MAX_TEXT_FILE_SIZE) {
        binaryCount++;
        appLogger.info({ filePath, msg: "Skipping oversized file", size: stats.size });
        return null;
      }

      const isBinary = await isBinaryFileQuick(realFullPath);
      if (isBinary) {
        binaryCount++;
        return null;
      }

      const content = await fs.readFile(realFullPath, "utf-8");

      return { content, path: filePath };
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

  if (sensitiveCount > 0) {
    taskLogger.warn(`File System: Skipped ${sensitiveCount} sensitive files`);
  }
  if (binaryCount > 0) {
    taskLogger.info(`File System: Ignored ${binaryCount} binary/asset files`);
  }

  if (validFiles.length === 0) {
    throw new Error("No valid text files found to analyze");
  }
  return validFiles;
}

const CHUNK_SIZE = 1024;

export function isBinaryBuffer(buffer: Uint8Array): boolean {
  const len = Math.min(buffer.length, CHUNK_SIZE);
  if (len === 0) {
    return false;
  }

  let suspiciousBytes = 0;

  for (let i = 0; i < len; i++) {
    const byte = buffer[i];

    if (byte === 0x00) {
      return true;
    }

    if (byte != null && (byte < 7 || byte > 14) && (byte < 32 || byte === 127)) {
      if (byte < 128) {
        suspiciousBytes++;
      }
    }
  }

  return suspiciousBytes / len > 0.1;
}

export async function isBinaryFileQuick(filePath: string): Promise<boolean> {
  let fileHandle: fs.FileHandle | null = null;
  try {
    fileHandle = await fs.open(filePath, "r");
    const buffer = Buffer.alloc(CHUNK_SIZE);
    const { bytesRead } = await fileHandle.read(buffer, 0, CHUNK_SIZE, 0);

    return isBinaryBuffer(buffer.subarray(0, bytesRead));
  } finally {
    await fileHandle?.close();
  }
}
