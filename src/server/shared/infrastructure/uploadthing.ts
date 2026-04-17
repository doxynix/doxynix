import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

import { getServerAuthSession } from "./auth";
import { prisma } from "./db";
import { logger } from "./logger";

const utapi = new UTApi();
const f = createUploadthing();

export const ourFileRouter = {
  avatarUploader: f({
    "image/jpeg": { maxFileCount: 1, maxFileSize: "4MB" },
    "image/png": { maxFileCount: 1, maxFileSize: "4MB" },
    "image/webp": { maxFileCount: 1, maxFileSize: "4MB" },
  })
    .middleware(async () => {
      const session = await getServerAuthSession();

      if (!session?.user) throw new UploadThingError("Unauthorized");

      return { userId: session.user.id };
    })
    .onUploadError(async ({ error, fileKey }) => {
      logger.error({
        code: error.code,
        error: error.message,
        key: fileKey,
        msg: "UploadThing upload error",
      });
    })
    .onUploadComplete(async ({ file, metadata }) => {
      const userId = Number(metadata.userId);
      if (Number.isNaN(userId)) {
        logger.error({ msg: "Invalid userId in upload metadata", userId: metadata.userId });
        throw new UploadThingError("Unauthorized");
      }
      logger.info({ msg: `Upload completed for: ${metadata.userId}` });
      logger.info({ msg: `"File URL:" ${file.ufsUrl}` });

      try {
        const user = await prisma.user.findUnique({
          select: { imageKey: true },
          where: { id: userId },
        });

        const oldKey = user?.imageKey;

        await prisma.user.update({
          data: {
            image: file.ufsUrl,
            imageKey: file.key,
          },
          where: { id: userId },
        });
        if (oldKey != null && oldKey !== file.key) {
          utapi.deleteFiles(oldKey).catch((error) => {
            logger.error({ error: error, msg: "Failed to delete old avatar" });
          });
        }
        return { url: file.ufsUrl };
      } catch (error) {
        logger.error({ error: error, msg: "DB user update error" });
        throw new UploadThingError("Failed to update avatar");
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
