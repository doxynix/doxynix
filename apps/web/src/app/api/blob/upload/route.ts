import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import * as z from "zod";

import { VERCEL_BLOB_CALLBACK_URL } from "@/shared/config/env.server";

import { appLogger } from "@/server/core/app-logger";
import { auth } from "@/server/core/auth";
import { prisma } from "@/server/core/db";
import { AppError, findAppError } from "@/server/utils/api-error";
import { withApiHandler } from "@/server/utils/with-api-handler";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

async function handler(request: Request) {
  // `request.json()` is typed `any`. The body is a Vercel SDK contract
  // (`GenerateClientTokenEvent | UploadCompletedEvent`) that `handleUpload`
  // validates and answers with a 400 itself, so reproducing that union here
  // would only duplicate the SDK. What is worth checking locally is that a
  // non-object body is rejected before it reaches the SDK.
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Invalid upload request" });
  }

  if (typeof rawBody !== "object" || rawBody == null) {
    throw new AppError({ code: "BAD_REQUEST", publicMessage: "Invalid upload request" });
  }

  const body = rawBody as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      onBeforeGenerateToken: async () => {
        const session = await auth.api.getSession({
          headers: await headers(),
        });

        if (session?.user == null) {
          appLogger.warn({ msg: "Blob upload rejected: Unauthorized" });
          throw new AppError({ code: "UNAUTHORIZED", publicMessage: "Unauthorized" });
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
        let rawUserId: unknown;
        try {
          const parsed = JSON.parse(tokenPayload ?? "{}");
          rawUserId = parsed?.userId;
        } catch {
          appLogger.error({ msg: "Malformed JSON in Blob tokenPayload", tokenPayload });
          return;
        }

        const userId = typeof rawUserId === "string" ? rawUserId : null;

        if (userId == null || !z.uuid().safeParse(userId).success) {
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
            try {
              await del(oldKey);
            } catch (error) {
              appLogger.error({
                error: error instanceof Error ? error.message : String(error),
                msg: "Failed to delete old avatar from Blob",
                oldKey,
                userId,
              });
            }
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
    // The UNAUTHORIZED thrown by `onBeforeGenerateToken` is an expected,
    // caller-facing rejection, so it must stay a 401 rather than be flattened
    // into the SDK's generic validation failure. The SDK wraps what it catches,
    // hence the cause-chain lookup.
    const appError = findAppError(error);

    if (appError != null) {
      throw appError;
    }

    // `handleUpload` throws a plain `Error` for its own validation failures
    // (unsupported content type, oversized body). Those are 400s carrying copy
    // the SDK wrote for humans, so the message is safe to echo.
    throw new AppError({
      cause: error,
      code: "BAD_REQUEST",
      publicMessage:
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Upload authorization failed",
    });
  }
}

export const POST = withApiHandler(handler, { scope: "blob/upload" });
