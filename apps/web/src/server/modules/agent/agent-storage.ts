import { UTApi } from "uploadthing/server";

import { appLogger } from "@/server/core/app-logger";

const utapi = new UTApi();

const MAX_BYTES = 10 * 1024 * 1024;

const MAX_BASE64_LENGTH = Math.ceil((MAX_BYTES * 4) / 3);

const ALLOWED_MIME_TYPES = new Set([
  "application/json",
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/markdown",
  "text/plain",
]);

type MessagePart = {
  [key: string]: unknown;
  filename?: string;
  type: string;
  url: string;
};

export async function processMessageParts(parts: MessagePart[]): Promise<MessagePart[]> {
  const processedParts: MessagePart[] = [];

  for (const part of parts) {
    if (part.type === "file" && part.url.startsWith("data:")) {
      if (part.url.length > MAX_BASE64_LENGTH) {
        appLogger.warn({
          filename: part.filename,
          length: part.url.length,
          msg: "Attachment rejected: Base64 payload string exceeds maximum allowed limit",
        });
        continue;
      }

      try {
        const match = /^data:([^;]+);base64,(.+)$/.exec(part.url);
        if (match == null) {
          processedParts.push(part);
          continue;
        }

        const [, mimeType, base64Data] = match;

        if (base64Data == null || mimeType == null) {
          processedParts.push(part);
          continue;
        }

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
          appLogger.warn({
            filename: part.filename,
            mimeType,
            msg: "Attachment rejected: MIME-type is not in the security whitelist",
          });
          continue;
        }

        const buffer = Buffer.from(base64Data, "base64");

        if (buffer.byteLength > MAX_BYTES) {
          appLogger.warn({
            byteLength: buffer.byteLength,
            filename: part.filename,
            msg: "Attachment rejected: Decoded buffer size exceeds 10MB limit",
          });
          continue;
        }

        const file = new File([new Uint8Array(buffer)], part.filename ?? "file", {
          type: mimeType,
        });

        const uploadResult = await utapi.uploadFiles(file);

        if (uploadResult.data != null) {
          processedParts.push({
            ...part,
            url: uploadResult.data.ufsUrl,
          });
        } else {
          appLogger.warn({
            filename: part.filename,
            msg: "UploadThing upload returned no data, skipping attachment",
          });
        }
      } catch (error) {
        appLogger.error({
          error: error instanceof Error ? error.message : String(error),
          filename: part.filename,
          msg: "Failed to upload base64 attachment to UploadThing",
        });
        processedParts.push(part);
      }
    } else {
      processedParts.push(part);
    }
  }

  return processedParts;
}
