import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const verifyAndUseApiKey = vi.hoisted(() => vi.fn());

vi.mock("@/server/core/auth", () => ({ auth: { api: auth } }));
vi.mock("@/server/core/auth/verify-api-key", () => ({ verifyAndUseApiKey }));

import { resolveRequestUserId } from "./resolve-session";

const bearer = (token: string) => new Headers({ authorization: `Bearer ${token}` });

beforeEach(() => {
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue(null);
  verifyAndUseApiKey.mockResolvedValue(null);
});

describe("resolveRequestUserId", () => {
  it("returns the api key owner for a valid bearer token", async () => {
    verifyAndUseApiKey.mockResolvedValue({ user: { id: "user-1" } });

    await expect(resolveRequestUserId(bearer("dxnx_valid"))).resolves.toBe("user-1");
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("falls back to the cookie session when the bearer token is rejected", async () => {
    verifyAndUseApiKey.mockResolvedValue(null);
    auth.getSession.mockResolvedValue({ user: { id: "user-2" } });

    await expect(resolveRequestUserId(bearer("dxnx_stale"))).resolves.toBe("user-2");
  });

  it("returns null when no credential is present", async () => {
    await expect(resolveRequestUserId(new Headers())).resolves.toBeNull();
    expect(verifyAndUseApiKey).not.toHaveBeenCalled();
  });

  it("ignores an authorization header that is not a bearer scheme", async () => {
    auth.getSession.mockResolvedValue(null);

    await expect(
      resolveRequestUserId(new Headers({ authorization: `Basic ${btoa("user:pass")}` })),
    ).resolves.toBeNull();
    expect(verifyAndUseApiKey).not.toHaveBeenCalled();
  });
});
