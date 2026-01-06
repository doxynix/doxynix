import { createUploadthing, type FileRouter } from "uploadthing/next";

import { getServerAuthSession } from "@/shared/api/auth/authOptions";
import { prisma } from "@/shared/api/db/db";

const f = createUploadthing();

export const ourFileRouter = {
  avatarUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerAuthSession();

      if (!session?.user) throw new Error("Unauthorized");

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Загрузка завершена для:", metadata.userId);
      console.log("URL файла:", file.ufsUrl);

      await prisma.user.update({
        where: { id: Number(metadata.userId) },
        data: {
          image: file.ufsUrl,
          imageKey: file.key,
        },
      });

      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
