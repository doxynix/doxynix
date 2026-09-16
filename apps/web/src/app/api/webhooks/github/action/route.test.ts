import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/github/action/route";
import { prisma } from "@/server/core/db";
import { repoAnalysisService } from "@/server/modules/analysis/analysis.service";
import { verifyAndUseApiKey } from "@/server/utils/verify-and-use-api-key";

const { mockAppLogger } = vi.hoisted(() => ({
  mockAppLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mockAppLogger }));

vi.mock("@/server/core/db", () => ({
  prisma: { repo: { findFirst: vi.fn() } },
}));

vi.mock("@/server/utils/verify-and-use-api-key", () => ({
  verifyAndUseApiKey: vi.fn(),
}));

vi.mock("@/server/modules/analysis/analysis.service", () => ({
  repoAnalysisService: { analyze: vi.fn() },
}));

const BEARER = { authorization: "Bearer valid-key" };

const makeReq = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/webhooks/github/action", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });

describe("POST /api/webhooks/github/action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAndUseApiKey).mockResolvedValue({
      id: 1,
      revoked: false,
      userId: 7,
    } as never);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(makeReq({ repository: "owner/repo" }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when Authorization is not Bearer", async () => {
    const res = await POST(makeReq({ repository: "owner/repo" }, { authorization: "Basic abc" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the API key is invalid", async () => {
    vi.mocked(verifyAndUseApiKey).mockResolvedValue(null);
    const res = await POST(makeReq({ repository: "owner/repo" }, BEARER));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Invalid API Key" });
  });

  it("returns 400 on unparseable JSON body", async () => {
    const req = new Request("http://localhost/api/webhooks/github/action", {
      body: "{not-json",
      headers: BEARER,
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON payload" });
  });

  it("returns 400 when repository is missing", async () => {
    const res = await POST(makeReq({ branch: "main" }, BEARER));
    expect(res.status).toBe(400);
    expect(vi.mocked(repoAnalysisService.analyze)).not.toHaveBeenCalled();
  });

  it("returns 400 when repository is not owner/name", async () => {
    const res = await POST(makeReq({ repository: "single-part" }, BEARER));
    expect(res.status).toBe(400);
    expect(vi.mocked(repoAnalysisService.analyze)).not.toHaveBeenCalled();
  });

  it("returns 404 when the repository is not registered", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue(null);
    const res = await POST(makeReq({ repository: "owner/repo" }, BEARER));
    expect(res.status).toBe(404);
    expect(vi.mocked(repoAnalysisService.analyze)).not.toHaveBeenCalled();
  });

  it("triggers analysis and returns the jobId (default branch)", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue({
      defaultBranch: "main",
      id: 42,
      publicId: "pub-1",
    } as never);
    vi.mocked(repoAnalysisService.analyze).mockResolvedValue({
      jobId: "job-123",
    } as never);

    const res = await POST(makeReq({ repository: "owner/repo" }, BEARER));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ jobId: "job-123" });
    expect(repoAnalysisService.analyze).toHaveBeenCalledTimes(1);
    expect(repoAnalysisService.analyze).toHaveBeenCalledWith(
      prisma,
      7,
      expect.objectContaining({
        branch: "main",
        language: "English",
        repoId: "pub-1",
      }),
    );
  });

  it("passes an explicit branch through", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue({
      defaultBranch: "main",
      id: 42,
      publicId: "pub-1",
    } as never);
    vi.mocked(repoAnalysisService.analyze).mockResolvedValue({
      jobId: "job-2",
    } as never);

    const res = await POST(makeReq({ branch: "develop", repository: "owner/repo" }, BEARER));

    expect(res.status).toBe(200);
    expect(repoAnalysisService.analyze).toHaveBeenCalledWith(
      prisma,
      7,
      expect.objectContaining({ branch: "develop" }),
    );
  });

  it("returns 500 when analysis throws", async () => {
    vi.mocked(prisma.repo.findFirst).mockResolvedValue({
      defaultBranch: "main",
      id: 42,
      publicId: "pub-1",
    } as never);
    vi.mocked(repoAnalysisService.analyze).mockRejectedValue(new Error("boom"));

    const res = await POST(makeReq({ repository: "owner/repo" }, BEARER));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal Server Error" });
  });
});
