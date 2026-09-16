import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  authApiGetSession: vi.fn(),
  del: vi.fn(),
  handleUpload: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@vercel/blob", () => ({ del: mocks.del }));
vi.mock("@vercel/blob/client", () => ({ handleUpload: mocks.handleUpload, type: {} }));
vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/auth", () => ({
  auth: { api: { getSession: mocks.authApiGetSession } },
}));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/shared/config/env.server", () => ({
  VERCEL_BLOB_CALLBACK_URL: "https://example.com",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { POST } from "./route";

async function captureHandlers() {
  await POST({
    json: async () => ({ payload: {}, type: "blob.upload-completed" }),
  } as unknown as Request);

  expect(mocks.handleUpload).toHaveBeenCalled();
  const [opts] = mocks.handleUpload.mock.calls.at(-1) as [
    {
      onBeforeGenerateToken: () => Promise<unknown>;
      onUploadCompleted: (args: { blob: unknown; tokenPayload: string }) => Promise<void>;
    },
  ];

  return {
    onBeforeGenerateToken: opts.onBeforeGenerateToken,
    onUploadCompleted: opts.onUploadCompleted,
  };
}

const BLOB = { pathname: "ivan/avatar.png", url: "https://blob/u.png" };

describe("POST route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns handleUpload response on success", async () => {
    mocks.handleUpload.mockResolvedValue({ status: "ok" });

    const response = await POST({
      json: async () => ({ payload: {}, type: "blob.upload-completed" }),
    } as unknown as Request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("returns 400 error response when handleUpload throws", async () => {
    mocks.handleUpload.mockRejectedValue(new Error("boom"));

    const response = await POST({
      json: async () => ({ payload: {}, type: "blob.upload-completed" }),
    } as unknown as Request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "boom" });
    expect(mocks.appLogger.error).toHaveBeenCalledWith({
      error: "boom",
      msg: "Blob upload authorization failed",
    });
  });

  it("returns 400 for non-Error thrown by handleUpload", async () => {
    mocks.handleUpload.mockRejectedValue("string error");

    const response = await POST({
      json: async () => ({ payload: {}, type: "blob.upload-completed" }),
    } as unknown as Request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Upload authorization failed" });
  });
});

describe("onBeforeGenerateToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Unauthorized when session is null", async () => {
    mocks.authApiGetSession.mockResolvedValue(null);

    const { onBeforeGenerateToken } = await captureHandlers();

    await expect(onBeforeGenerateToken()).rejects.toThrow("Unauthorized");
    expect(mocks.appLogger.warn).toHaveBeenCalledWith({
      msg: "Blob upload rejected: Unauthorized",
    });
  });

  it("throws Unauthorized when session has no user", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: null });

    const { onBeforeGenerateToken } = await captureHandlers();

    await expect(onBeforeGenerateToken()).rejects.toThrow("Unauthorized");
    expect(mocks.appLogger.warn).toHaveBeenCalledWith({
      msg: "Blob upload rejected: Unauthorized",
    });
  });

  it("returns correct config for valid session", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "9" } });

    const { onBeforeGenerateToken } = await captureHandlers();

    const result = await onBeforeGenerateToken();

    expect(result).toEqual({
      allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
      callbackUrl: "https://example.com/api/blob/upload",
      maximumSizeInBytes: 5_242_880,
      tokenPayload: JSON.stringify({ userId: "9" }),
    });
  });
});

describe("onUploadCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates user and deletes old avatar when oldKey differs from new pathname", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: "old/key.png" });
    mocks.prisma.user.update.mockResolvedValue({});
    mocks.del.mockResolvedValue({});

    const { onUploadCompleted } = await captureHandlers();

    await onUploadCompleted({ blob: BLOB, tokenPayload: JSON.stringify({ userId: 5 }) });

    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({
      select: { imageKey: true },
      where: { id: 5 },
    });
    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      data: { image: BLOB.url, imageKey: BLOB.pathname },
      where: { id: 5 },
    });
    expect(mocks.del).toHaveBeenCalledWith("old/key.png");
  });

  it("does not delete old avatar when oldKey is null", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: null });
    mocks.prisma.user.update.mockResolvedValue({});

    const { onUploadCompleted } = await captureHandlers();

    await onUploadCompleted({ blob: BLOB, tokenPayload: JSON.stringify({ userId: 5 }) });

    expect(mocks.prisma.user.update).toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("does not delete old avatar when oldKey equals new pathname", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: BLOB.pathname });
    mocks.prisma.user.update.mockResolvedValue({});

    const { onUploadCompleted } = await captureHandlers();

    await onUploadCompleted({ blob: BLOB, tokenPayload: JSON.stringify({ userId: 5 }) });

    expect(mocks.prisma.user.update).toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("returns early with error log when userId is a string (NaN)", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });

    const { onUploadCompleted } = await captureHandlers();

    await onUploadCompleted({
      blob: BLOB,
      tokenPayload: '{"userId":"abc"}',
    });

    expect(mocks.appLogger.error).toHaveBeenCalledWith({
      msg: "Invalid userId in Blob upload metadata",
      rawUserId: "abc",
    });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it("returns early when tokenPayload is null", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });

    const { onUploadCompleted } = await captureHandlers();

    await onUploadCompleted({ blob: BLOB, tokenPayload: "null" });

    expect(mocks.appLogger.error).toHaveBeenCalled();
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns early when tokenPayload is {}", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });

    const { onUploadCompleted } = await captureHandlers();

    await onUploadCompleted({ blob: BLOB, tokenPayload: "{}" });

    expect(mocks.appLogger.error).toHaveBeenCalledWith({
      msg: "Invalid userId in Blob upload metadata",
      rawUserId: undefined,
    });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns early when tokenPayload is malformed JSON", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });

    const { onUploadCompleted } = await captureHandlers();

    await onUploadCompleted({
      blob: BLOB,
      tokenPayload: "not-json{{",
    });

    expect(mocks.appLogger.error).toHaveBeenCalledWith({
      msg: "Malformed JSON in Blob tokenPayload",
      tokenPayload: "not-json{{",
    });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("catches update errors without rethrowing", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: null });
    mocks.prisma.user.update.mockRejectedValue(new Error("update failed"));

    const { onUploadCompleted } = await captureHandlers();

    await expect(
      onUploadCompleted({
        blob: BLOB,
        tokenPayload: JSON.stringify({ userId: 5 }),
      }),
    ).resolves.toBeUndefined();

    expect(mocks.appLogger.error).toHaveBeenCalledWith({
      error: "update failed",
      msg: "DB user update error after Blob upload",
      userId: 5,
    });
  });

  it("catches del errors without rethrowing", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });
    mocks.prisma.user.findUnique.mockResolvedValue({ imageKey: "old/key.png" });
    mocks.prisma.user.update.mockResolvedValue({});
    mocks.del.mockRejectedValue(new Error("delete failed"));

    const { onUploadCompleted } = await captureHandlers();

    await expect(
      onUploadCompleted({
        blob: BLOB,
        tokenPayload: JSON.stringify({ userId: 5 }),
      }),
    ).resolves.toBeUndefined();

    expect(mocks.appLogger.error).toHaveBeenCalledWith({
      error: "delete failed",
      msg: "Failed to delete old avatar from Blob",
      oldKey: "old/key.png",
      userId: 5,
    });
  });
});
