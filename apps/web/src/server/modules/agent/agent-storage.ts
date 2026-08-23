import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

import { appLogger } from "@/server/core/app-logger";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_BASE64_LENGTH = Math.ceil((MAX_BYTES * 4) / 3);

const ALLOWED_MIME_TYPES = new Set([
  "application/json",
  "application/pdf",
  "application/toml",
  "application/x-gzip",
  "application/x-tar",
  "application/x-yaml",
  "application/x-zip-compressed",
  "application/xml",
  "application/zip",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/markdown",
  "text/plain",
  "text/tab-separated-values",
  "text/xml",
  "text/yaml",
]);

type MessagePart = {
  [key: string]: unknown;
  filename?: string;
  type: string;
  url: string;
};

export async function processMessageParts(parts: MessagePart[]): Promise<MessagePart[]> {
  const processPart = async (part: MessagePart): Promise<MessagePart | null> => {
    if (part.type !== "file" || !part.url.startsWith("data:")) {
      return part;
    }

    if (part.url.length > MAX_BASE64_LENGTH) {
      appLogger.warn({
        filename: part.filename,
        length: part.url.length,
        msg: "Attachment rejected: Base64 payload string exceeds maximum allowed limit",
      });
      return null;
    }

    try {
      const match = /^data:([^;]+);base64,(.+)$/.exec(part.url);
      if (match == null) return null;

      const [, mimeType, base64Data] = match;
      if (base64Data == null || mimeType == null) return null;

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        appLogger.warn({
          filename: part.filename,
          mimeType,
          msg: "Attachment rejected: MIME-type is not in the security whitelist",
        });
        return null;
      }

      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.byteLength > MAX_BYTES) {
        appLogger.warn({
          byteLength: buffer.byteLength,
          filename: part.filename,
          msg: "Attachment rejected: Decoded buffer size exceeds 10MB limit",
        });
        return null;
      }

      const rawFileName = part.filename ?? "chat-attachment";

      const cleanFileName = rawFileName
        .toLowerCase()
        .replaceAll(/\s+/g, "-")
        .replaceAll(/[^\d._a-z-]/g, "");

      const uniquePrefix = `${Date.now()}-${randomUUID()}`;
      const finalFileName = `${uniquePrefix}-${cleanFileName}`;

      const blob = await put(`agent-attachments/${finalFileName}`, buffer, {
        access: "public",
        contentType: mimeType,
      });

      return {
        ...part,
        url: blob.url,
      };
    } catch (error) {
      appLogger.error({
        error: error instanceof Error ? error.message : String(error),
        filename: part.filename,
        msg: "Failed to upload base64 attachment to Vercel Blob",
      });
      return null;
    }
  };

  const processed = await Promise.all(parts.map((part) => processPart(part)));
  return processed.filter((part): part is MessagePart => part != null);
}
