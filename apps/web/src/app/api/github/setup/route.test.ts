import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appLogger: { debug: vi.fn(), error: vi.fn(), flush: vi.fn(), info: vi.fn(), warn: vi.fn() },
  authApiGetSession: vi.fn(),
  prisma: {},
  redirect: vi.fn((url: string) => {
    const e = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest?: string };
    e.digest = `NEXT_REDIRECT:${url}`;
    throw e;
  }),
  saveInstallation: vi.fn(),
  unauthorized: vi.fn(() => {
    const e = new Error("NEXT_UNAUTHORIZED") as Error & { digest?: string };
    e.digest = "NEXT_UNAUTHORIZED";
    throw e;
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, unauthorized: mocks.unauthorized }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/auth", () => ({
  auth: { api: { getSession: mocks.authApiGetSession } },
}));
vi.mock("@/server/core/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/server/core/github/github-app.service", () => ({
  githubAppService: { saveInstallation: mocks.saveInstallation },
}));

import { GET } from "./route";

function makeRequest(params: Record<string, string>): NextRequest {
  const url = `https://doxynix.dev/api/github/setup?${new URLSearchParams(params)}`;
  return new NextRequest(url);
}

async function expectRedirect(fn: Promise<unknown>, expectedUrl: string) {
  await expect(fn).rejects.toThrow(
    expect.objectContaining({ digest: `NEXT_REDIRECT:${expectedUrl}` }),
  );
}

describe("GET /api/github/setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authApiGetSession.mockResolvedValue({ user: { id: "5" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw NEXT_UNAUTHORIZED when there is no session", async () => {
    mocks.authApiGetSession.mockResolvedValue(null);

    await expect(GET(makeRequest({}))).rejects.toThrow("NEXT_UNAUTHORIZED");

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("should throw NEXT_UNAUTHORIZED when session user id is null", async () => {
    mocks.authApiGetSession.mockResolvedValue({ user: { id: null } });

    await expect(GET(makeRequest({}))).rejects.toThrow("NEXT_UNAUTHORIZED");

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("should redirect to setup_params_missing when no params provided", async () => {
    await expectRedirect(GET(makeRequest({})), "/dashboard?error=setup_params_missing");
    expect(mocks.redirect).toHaveBeenCalled();
  });

  it("should call getSession with headers", async () => {
    await expectRedirect(GET(makeRequest({})), "/dashboard?error=setup_params_missing");

    expect(mocks.authApiGetSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
  });

  it("should redirect to success without calling saveInstallation in background mode (state=null, installation_id present)", async () => {
    await expectRedirect(
      GET(makeRequest({ installation_id: "888" })),
      "/dashboard?success=github_connected",
    );

    expect(mocks.saveInstallation).not.toHaveBeenCalled();
    expect(mocks.appLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ installationId: "888", userId: "5" }),
    );
  });

  it("should redirect to setup_params_missing when state is present but installation_id is null", async () => {
    await expectRedirect(
      GET(makeRequest({ state: "abc" })),
      "/dashboard?error=setup_params_missing",
    );
    expect(mocks.redirect).toHaveBeenCalled();
  });

  it("should redirect to success and call saveInstallation when state and installation_id are both present", async () => {
    mocks.saveInstallation.mockResolvedValue(undefined);

    await expectRedirect(
      GET(makeRequest({ installation_id: "777", state: "abc" })),
      "/dashboard?success=github_connected",
    );

    expect(mocks.saveInstallation).toHaveBeenCalledWith(mocks.prisma, 5, "777", "abc");
  });

  it("should redirect to setup_failed and log error when saveInstallation throws", async () => {
    mocks.saveInstallation.mockRejectedValue(new Error("boom"));

    await expectRedirect(
      GET(makeRequest({ installation_id: "777", state: "abc" })),
      "/dashboard?error=setup_failed",
    );

    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: "boom", msg: "GitHub Setup Error:" }),
    );
  });

  it("should handle saveInstallation rejecting with a non-Error value", async () => {
    mocks.saveInstallation.mockRejectedValue("string-error");

    await expectRedirect(
      GET(makeRequest({ installation_id: "777", state: "abc" })),
      "/dashboard?error=setup_failed",
    );

    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: "string-error", msg: "GitHub Setup Error:" }),
    );
  });
});
