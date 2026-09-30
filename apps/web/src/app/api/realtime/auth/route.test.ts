import { describe, expect, it, vi } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), warn: vi.fn() },
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

const req = () => new Request("http://localhost/api/realtime/auth");

describe("GET /api/realtime/auth — Capability Security Matrix", () => {
  it("authorizes logged-in user with personal channel presence and system access", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce({ user: { id: "42" } });
    mocks.createTokenRequest.mockResolvedValueOnce({ token: "auth-token" });

    const res = await GET(req());

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

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(mocks.createTokenRequest).toHaveBeenCalledWith({
      capability: JSON.stringify({
        [REALTIME_CONFIG.channels.news]: ["subscribe"],
      }),
      clientId: "anonymous",
      ttl: 3_600_000,
    });
  });

  it("returns 500 with the shared envelope and logs when token creation throws", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce({ user: { id: "42" } });
    mocks.createTokenRequest.mockRejectedValueOnce(new Error("Ably cluster timeout"));

    const res = await GET(req());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ably cluster timeout",
        requestId: expect.any(String),
      },
    });
    expect(mocks.appLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error), unexpected: true }),
    );
  });

  it("assigns a requestId so a failure can be correlated with server logs", async () => {
    mocks.authApiGetSession.mockResolvedValueOnce(null);
    mocks.createTokenRequest.mockRejectedValueOnce(new Error("Ably cluster timeout"));

    const res = await GET(
      new Request("http://localhost/api/realtime/auth", {
        headers: { "x-request-id": "trace-abc" },
      }),
    );

    const body = (await res.json()) as { error: { requestId: string } };
    expect(body.error.requestId).toBe("trace-abc");
  });
});
