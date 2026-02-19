import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

import { getServerAuthSession } from "@/shared/api/auth/auth-options";
import { prisma } from "@/shared/api/db/db";
import { logger } from "@/shared/lib/logger";

const utapi = new UTApi();
const f = createUploadthing();

export const ourFileRouter = {
  avatarUploader: f({
    "image/jpeg": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/png": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/gif": { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getServerAuthSession();

      if (!session?.user) throw new UploadThingError("Unauthorized");

      return { userId: session.user.id };
    })
    .onUploadError(async ({ error, fileKey }) => {
      logger.error({
        msg: "UploadThing upload error",
        error: error.message,
        code: error.code,
        key: fileKey,
      });
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const userId = Number(metadata.userId);
      logger.info({ msg: `Upload completed for: ${metadata.userId}` });
      logger.info({ msg: `"File URL:" ${file.ufsUrl}` });

      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { imageKey: true },
        });

        const oldKey = user?.imageKey;

        await prisma.user.update({
          where: { id: userId },
          data: {
            image: file.ufsUrl,
            imageKey: file.key,
          },
        });
        if (oldKey !== null && oldKey !== undefined && oldKey !== file.key) {
          utapi.deleteFiles(oldKey).catch((e) => {
            logger.error({ msg: "Failed to delete old avatar", error: e });
          });
        }
        return { url: file.ufsUrl };
      } catch (err) {
        logger.error({ msg: "DB user update error", error: err });
        throw new UploadThingError("Failed to update avatar");
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
