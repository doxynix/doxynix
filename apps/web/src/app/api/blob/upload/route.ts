import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { VERCEL_BLOB_CALLBACK_URL } from "@/shared/constants/env.server";

import { appLogger } from "@/server/core/app-logger";
import { auth } from "@/server/core/auth";
import { prisma } from "@/server/core/db";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      onBeforeGenerateToken: async () => {
        const session = await auth.api.getSession({
          headers: await headers(),
        });

        if (session?.user == null) {
          appLogger.warn({ msg: "Blob upload rejected: Unauthorized" });
          throw new Error("Unauthorized");
        }

        const callbackUrl = `${VERCEL_BLOB_CALLBACK_URL}/api/blob/upload`;

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          callbackUrl,
          maximumSizeInBytes: MAX_FILE_SIZE,
          tokenPayload: JSON.stringify({ userId: session.user.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { userId: rawUserId } = JSON.parse(tokenPayload ?? "{}");
        const userId = Number(rawUserId);

        if (Number.isNaN(userId)) {
          appLogger.error({ msg: "Invalid userId in Blob upload metadata", rawUserId });
          return;
        }

        appLogger.info({ msg: `Blob upload completed for user: ${userId}`, userId });
        appLogger.info({ msg: `"File URL:" ${blob.url}`, url: blob.url });

        try {
          const user = await prisma.user.findUnique({
            select: { imageKey: true },
            where: { id: userId },
          });

          const oldKey = user?.imageKey;

          await prisma.user.update({
            data: {
              image: blob.url,
              imageKey: blob.pathname,
            },
            where: { id: userId },
          });

          if (oldKey != null && oldKey !== blob.pathname) {
            del(oldKey).catch((error) => {
              appLogger.error({
                error: error instanceof Error ? error.message : String(error),
                msg: "Failed to delete old avatar from Blob",
                oldKey,
                userId,
              });
            });
          }
        } catch (error) {
          appLogger.error({
            error: error instanceof Error ? error.message : String(error),
            msg: "DB user update error after Blob upload",
            userId,
          });
        }
      },
      request,
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    appLogger.error({
      error: error instanceof Error ? error.message : String(error),
      msg: "Blob upload authorization failed",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload authorization failed" },
      { status: 400 }
    );
  }
}
