import { describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn() },
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

describe("GET /api/realtime/auth — Capability Security Matrix", () => {
  it("authorizes logged-in user with personal channel presence and system access", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce({ user: { id: "42" } });
    mocks.createTokenRequest.mockResolvedValueOnce({ token: "auth-token" });

    const res = await GET();

    expect(res.status).toBe(200);
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

  it("strictly restricts anonymous callers to public news channel without personal access", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce(null);
    mocks.createTokenRequest.mockResolvedValueOnce({ token: "anon-token" });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(mocks.createTokenRequest).toHaveBeenCalledWith({
      capability: JSON.stringify({
        [REALTIME_CONFIG.channels.news]: ["subscribe"],
      }),
      clientId: "anonymous",
      ttl: 3_600_000,
    });
  });

  it("returns 500 and logs when realtime provider token creation throws", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce({ user: { id: "42" } });
    mocks.createTokenRequest.mockRejectedValueOnce(new Error("Ably cluster timeout"));

    const res = await GET();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Error requesting token" });
  });
});
