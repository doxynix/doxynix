import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { getServerAuthSession } from "@/shared/api/auth/authOptions";
import { prisma } from "@/shared/api/db/db";
import { logger } from "@/shared/lib/logger";

const f = createUploadthing();

export const ourFileRouter = {
  avatarUploader: f({
    "image/jpeg": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/png": { maxFileSize: "4MB", maxFileCount: 1 },
    "image/gif": { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getServerAuthSession();

      if (!session?.user) throw new Error("Unauthorized");

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
      logger.info({ msg: `Upload completed for: ${metadata.userId}` });
      logger.info({ msg: `"File URL:" ${file.ufsUrl}` });

      try {
        await prisma.user.update({
          where: { id: Number(metadata.userId) },
          data: {
            image: file.ufsUrl,
          },
        });
      } catch (err) {
        logger.error({ msg: "DB user update error", error: err });
        throw new UploadThingError("Failed to update avatar");
      }

      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
