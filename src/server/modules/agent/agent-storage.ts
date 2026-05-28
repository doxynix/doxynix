import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

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
      try {
        const match = /^data:([^;]+);base64,(.+)$/.exec(part.url);
        if (match == null) {
          processedParts.push(part);
          continue;
        }

        const [, mimeType, base64Data] = match;

        if (base64Data == null) {
          processedParts.push(part);
          continue;
        }

        const buffer = Buffer.from(base64Data, "base64");

        const file = new File([new Uint8Array(buffer)], part.filename ?? "file", {
          type: mimeType ?? "application/octet-stream",
        });

        const uploadResult = await utapi.uploadFiles(file);

        if (uploadResult.data != null) {
          processedParts.push({
            ...part,
            url: uploadResult.data.ufsUrl,
          });
        } else {
          processedParts.push(part);
        }
      } catch (error) {
        console.error("Failed to upload base64 attachment to UploadThing:", error);
        processedParts.push(part);
      }
    } else {
      processedParts.push(part);
    }
  }

  return processedParts;
}
