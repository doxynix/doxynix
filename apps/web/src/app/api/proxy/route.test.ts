/* eslint-disable sonarjs/no-hardcoded-ip */
import dns from "node:dns";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/core/auth";

import { isSafeIp, POST, ssrfSafeLookup } from "./route";

const mocks = vi.hoisted(() => ({
  appLogger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/core/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));

const globalFetchMock = vi.fn();
vi.stubGlobal("fetch", globalFetchMock);

describe("Proxy API Route — SSRF Prevention Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "usr-1" },
    } as any);
  });

  describe("1. isSafeIp (SSRF IP blacklist validation)", () => {
    it("permits safe public IPs", () => {
      expect(isSafeIp("8.8.8.8")).toBe(true);
      expect(isSafeIp("1.1.1.1")).toBe(true);
      expect(isSafeIp("140.82.121.4")).toBe(true);
    });

    it.each([
      ["127.0.0.1", "loopback"],
      ["::1", "loopback"],
      ["169.254.169.254", "cloud metadata (AWS/GCP)"],
      ["192.168.1.1", "private subnet"],
      ["10.0.0.1", "private subnet"],
      ["172.16.0.1", "private subnet"],
      ["fc00::", "unique local IPv6"],
      ["fe80::1", "link local IPv6"],
      ["0.0.0.0", "unspecified"],
      ["255.255.255.255", "broadcast"],
    ])("blocks unsafe IP %s (%s)", (ip) => {
      expect(isSafeIp(ip)).toBe(false);
    });
  });

  describe("2. ssrfSafeLookup (DNS hook for Undici Agent)", () => {
    it("allows safe resolved addresses through", () => {
      const cb = vi.fn();
      vi.spyOn(dns, "lookup").mockImplementation(((_h: any, _o: any, callback?: any) => {
        const cbFn = typeof _o === "function" ? _o : callback;
        cbFn(null, "8.8.8.8", 4);
      }) as any);

      ssrfSafeLookup("google.com", {}, cb);
      expect(cb).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    });

    it("rejects loopback address and throws Unsafe target IP error", () => {
      const cb = vi.fn();
      vi.spyOn(dns, "lookup").mockImplementation(((_h: any, _o: any, callback?: any) => {
        const cbFn = typeof _o === "function" ? _o : callback;
        cbFn(null, "127.0.0.1", 4);
      }) as any);

      ssrfSafeLookup("localhost", {}, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(Error), null, null);
      expect(cb.mock.calls[0]![0].message).toBe("Forbidden: Unsafe target IP detected");
    });
  });

  describe("3. POST handler protocol and header sanitization", () => {
    it("strictly forbids non-http protocols (file://, gopher://)", async () => {
      const req = new Request("http://localhost/api/proxy", {
        body: JSON.stringify({ method: "GET", url: "file:///etc/passwd" }),
        method: "POST",
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      await expect(res.text()).resolves.toBe("Forbidden: Unsafe protocol");
    });

    it("strips sensitive headers (cookie, host, connection) before sending request", async () => {
      globalFetchMock.mockResolvedValueOnce({
        headers: new Headers(),
        status: 200,
        text: async () => "ok",
      });

      const req = new Request("http://localhost/api/proxy", {
        body: JSON.stringify({
          headers: { connection: "close", cookie: "secret=1", host: "evil.com", "x-custom": "ok" },
          method: "GET",
          url: "https://example.com/api",
        }),
        method: "POST",
      });

      await POST(req);

      expect(globalFetchMock).toHaveBeenCalledWith(
        "https://example.com/api",
        expect.objectContaining({
          headers: { "x-custom": "ok" },
        }),
      );
    });
  });
});
