import { describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

const mocks = vi.hoisted(() => ({
  appLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  authApiGetSession: vi.fn(),
  createTokenRequest: vi.fn(),
}));

vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));
vi.mock("@/server/core/auth", () => ({
  auth: { api: { getSession: mocks.authApiGetSession } },
}));
vi.mock("@/server/core/realtime", () => ({
  realtimeServer: { auth: { createTokenRequest: mocks.createTokenRequest } },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { GET } from "./route";

describe("GET /api/realtime/auth", () => {
  it("returns token request with full capability when session is present", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce({
      user: { id: "42" },
    });
    mocks.createTokenRequest.mockResolvedValueOnce({ token: "T" });

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ token: "T" });
    expect(mocks.authApiGetSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
    expect(mocks.createTokenRequest).toHaveBeenCalledWith({
      capability: JSON.stringify({
        [REALTIME_CONFIG.channels.news]: ["subscribe"],
        [REALTIME_CONFIG.channels.user("42")]: ["subscribe", "presence"],
        [REALTIME_CONFIG.channels.system]: ["subscribe"],
      }),
      clientId: "42",
      ttl: 3_600_000,
    });
  });

  it("returns token request with anonymous clientId and minimal capability when no session", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce(null);
    mocks.createTokenRequest.mockResolvedValueOnce({ token: "anon-token" });

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ token: "anon-token" });
    expect(mocks.createTokenRequest).toHaveBeenCalledWith({
      capability: JSON.stringify({
        [REALTIME_CONFIG.channels.news]: ["subscribe"],
      }),
      clientId: "anonymous",
      ttl: 3_600_000,
    });
  });

  it("returns 500 and logs error when createTokenRequest throws", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce({
      user: { id: "42" },
    });
    mocks.createTokenRequest.mockRejectedValueOnce(new Error("b"));

    const res = await GET();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Error requesting token" });
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "Realtime auth error" }),
    );
  });
});
