import { beforeEach, describe, expect, it, vi } from "vitest";

const { put } = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock("@vercel/blob", () => ({ put }));

vi.mock("@/server/core/app-logger", () => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { appLogger } from "@/server/core/app-logger";

import { processMessageParts } from "./agent-storage";

const BLOB_URL = "https://blob.example.com/abc";
const MAX_BASE64_LENGTH = Math.ceil((10 * 1024 * 1024 * 4) / 3);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processMessageParts", () => {
  it("returns non-file parts as-is without calling put", async () => {
    const part = { type: "text", url: "https://example.com/txt" };
    const result = await processMessageParts([part]);
    expect(result).toEqual([part]);
    expect(put).not.toHaveBeenCalled();
  });

  it("returns file parts with non-data: URL as-is without calling put", async () => {
    const part = { type: "file", url: "https://example.com/x.png" };
    const result = await processMessageParts([part]);
    expect(result).toEqual([part]);
    expect(put).not.toHaveBeenCalled();
  });

  it("returns file parts with missing or non-string url as-is without crashing", async () => {
    const part = { type: "file" } as any;
    const result = await processMessageParts([part]);
    expect(result).toEqual([part]);
  });

  it("filters out file with data: URL exceeding MAX_BASE64_LENGTH", async () => {
    const oversized = "data:image/png;base64," + "A".repeat(MAX_BASE64_LENGTH);
    const part = { filename: "huge.png", type: "file", url: oversized };

    const result = await processMessageParts([part]);
    expect(result).toHaveLength(0);
    expect(put).not.toHaveBeenCalled();
    expect(appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Attachment rejected: Base64 payload string exceeds maximum allowed limit",
      }),
    );
  });

  it("uploads valid base64 file with allowed MIME type", async () => {
    put.mockResolvedValue({ url: BLOB_URL });
    const b64 = Buffer.from("hello").toString("base64");
    const part = {
      filename: "test.png",
      type: "file",
      url: `data:image/png;base64,${b64}`,
    };

    const result = await processMessageParts([part]);

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe(BLOB_URL);
    expect(result[0]!.filename).toBe("test.png");
    expect(result[0]!.type).toBe("file");
    expect(put).toHaveBeenCalledOnce();
    expect(put.mock.calls[0]![0]).toMatch(/^agent-attachments\//);
    expect(put.mock.calls[0]![2]).toEqual({
      access: "public",
      contentType: "image/png",
    });
  });

  it("filters out file with disallowed MIME type", async () => {
    const b64 = Buffer.from("exe").toString("base64");
    const part = {
      filename: "malware.exe",
      type: "file",
      url: `data:application/x-msdownload;base64,${b64}`,
    };

    const result = await processMessageParts([part]);
    expect(result).toHaveLength(0);
    expect(put).not.toHaveBeenCalled();
    expect(appLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Attachment rejected: MIME-type is not in the security whitelist",
      }),
    );
  });

  it("handles put throwing an error gracefully", async () => {
    put.mockRejectedValue(new Error("Blob service unavailable"));
    const b64 = Buffer.from("hello").toString("base64");
    const part = {
      filename: "doc.pdf",
      type: "file",
      url: `data:application/pdf;base64,${b64}`,
    };

    const result = await processMessageParts([part]);
    expect(result).toHaveLength(0);
    expect(appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Failed to upload base64 attachment to Vercel Blob",
      }),
    );
  });
});
