import { createUploadthing, UploadThingError, UTApi, type FileRouter } from "uploadthing/server";

import type { appLogger } from "./app-logger";
import { getServerAuthSession } from "./auth";
import type { prisma } from "./db";

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
      appLogger.error({
        code: error.code,
        error: error.message,
        key: fileKey,
        msg: "UploadThing upload error",
      });
    })
    .onUploadComplete(async ({ file, metadata }) => {
      const userId = Number(metadata.userId);
      if (Number.isNaN(userId)) {
        appLogger.error({ msg: "Invalid userId in upload metadata", userId: metadata.userId });
        throw new UploadThingError("Unauthorized");
      }
      appLogger.info({ msg: `Upload completed for: ${metadata.userId}` });
      appLogger.info({ msg: `"File URL:" ${file.ufsUrl}` });

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
            appLogger.error({ error: error, msg: "Failed to delete old avatar" });
          });
        }
        return { url: file.ufsUrl };
      } catch (error) {
        appLogger.error({ error: error, msg: "DB user update error" });
        throw new UploadThingError("Failed to update avatar");
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
