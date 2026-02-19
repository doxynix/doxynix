import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { isBinaryFile } from "isbinaryfile";

import { prisma } from "@/shared/api/db/db";
import { REALTIME_CONFIG } from "@/shared/constants/realtime";
import { logger } from "@/shared/lib/logger";

import { StatusSchema } from "@/generated/zod";
import { realtimeServer } from "@/server/lib/realtime";

export async function handleError(
  error: unknown,
  analysisId: string,
  channelName: string,
  tempPath: string
) {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error({
    msg: "TASK_ERROR",
    analysisId,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  });

  await cleanup(tempPath);

  await prisma.analysis.update({
    where: { publicId: analysisId },
    data: {
      status: StatusSchema.enum.FAILED,
      error: message,
      message: "Analysis failed",
    },
  });

  void realtimeServer.channels
    .get(channelName)
    ?.publish(REALTIME_CONFIG.events.user.analysisProgress, {
      analysisId,
      status: "FAILED",
      message,
    });
}

export async function cleanup(dirPath: string) {
  if (existsSync(dirPath)) {
    logger.info({ msg: "Removing temp clone path", path: dirPath });
    await fs.rm(dirPath, { recursive: true, force: true });
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
          msg: "Security: attempt to read file outside of basePath",
          filePath,
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

      return { path: filePath, content: buffer.toString("utf-8") };
    } catch (e) {
      logger.warn({
        msg: "Failed to read file",
        filePath,
        error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
      });
      return null;
    }
  });

  const validFiles = (await Promise.all(filePromises)).filter(
    (f): f is { path: string; content: string } => f !== null
  );

  if (validFiles.length === 0) throw new Error("No valid text files found to analyze");
  return validFiles;
}
