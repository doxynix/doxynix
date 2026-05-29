/* eslint-disable sonarjs/no-hardcoded-ip */
import dns from "node:dns";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isSafeIp, POST, ssrfSafeAgent } from "@/app/api/proxy/route";

// 1. Мокаем сессию авторизации NextAuth
const mockGetServerAuthSession = vi.fn();
vi.mock("@/server/core/auth", () => ({
  getServerAuthSession: () => mockGetServerAuthSession(),
}));

// 2. Мокаем системный логгер
const mockAppLogger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
};
vi.mock("@/server/core/app-logger", () => ({
  appLogger: mockAppLogger,
}));

// 3. Мокаем глобальный fetch
const globalFetchMock = vi.fn();
vi.stubGlobal("fetch", globalFetchMock);

describe("Proxy API Route & SSRF Prevention Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Дефолтное состояние авторизованного пользователя
    mockGetServerAuthSession.mockResolvedValue({
      user: { email: "developer@doxynix.com", id: "user_test_2026" },
    });

    // Дефолтный успешный ответ проксируемого сервера
    globalFetchMock.mockResolvedValue({
      headers: new Headers({ "content-type": "application/json" }),
      status: 200,
      text: async () => "success-payload",
    });
  });

  describe("1. Unit-test: isSafeIp validation logic", () => {
    it("should return true for safe public IPs", () => {
      expect(isSafeIp("8.8.8.8")).toBe(true);
      expect(isSafeIp("1.1.1.1")).toBe(true);
      expect(isSafeIp("140.82.121.4")).toBe(true); // GitHub IP
    });

    const unsafeIpCases = [
      { ip: "127.0.0.1", range: "loopback" },
      { ip: "::1", range: "loopback" },
      { ip: "192.168.1.100", range: "private" },
      { ip: "10.0.0.1", range: "private" },
      { ip: "172.16.5.5", range: "private" },
      { ip: "169.254.169.254", range: "linkLocal" },
      { ip: "fe80::1", range: "linkLocal" },
      { ip: "fc00::", range: "uniqueLocal" },
      { ip: "100.64.0.1", range: "carrierGradeNat" },
      { ip: "0.0.0.0", range: "unspecified" },
      { ip: "255.255.255.255", range: "broadcast" },
    ];

    it.each(unsafeIpCases)("should return false for unsafe IP $ip ($range)", ({ ip }) => {
      expect(isSafeIp(ip)).toBe(false);
    });

    it("should return false for non-valid IP strings", () => {
      expect(isSafeIp("invalid-string")).toBe(false);
      expect(isSafeIp("999.999.999.999")).toBe(false);
    });
  });

  describe("2. Isolated Unit-test: ssrfSafeAgent connect lookup", () => {
    // Извлекаем функцию lookup из опций агента
    const agentOptions = (ssrfSafeAgent as any).opts;
    const lookupFn = agentOptions?.connect?.lookup;

    it("should extract lookup function from agent config", () => {
      expect(lookupFn).toBeTypeOf("function");
    });

    it("should let safe IPs pass through lookup", () => {
      const callback = vi.fn();

      // Мокаем dns.lookup в контексте теста
      const dnsLookupSpy = vi.spyOn(dns, "lookup").mockImplementation((hostname, options, cb) => {
        (cb as any)(null, "8.8.8.8", 4);
        return {} as any;
      });

      lookupFn("safe-domain.com", {}, callback);

      expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
      dnsLookupSpy.mockRestore();
    });

    it("should block loopback and unsafe IPs on lookup and log warning", () => {
      const callback = vi.fn();

      const dnsLookupSpy = vi.spyOn(dns, "lookup").mockImplementation((hostname, options, cb) => {
        (cb as any)(null, "127.0.0.1", 4);
        return {} as any;
      });

      lookupFn("localhost", {}, callback);

      // Проверяем, что callback вызван с ошибкой SSRF
      expect(callback).toHaveBeenCalledWith(expect.any(Error), null, null);

      const errorArg = callback.mock.calls[0][0];
      expect(errorArg.message).toBe("Forbidden: Unsafe target IP detected");

      // Проверяем аудит-логгер
      expect(mockAppLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "127.0.0.1",
          hostname: "localhost",
          msg: "SSRF prevention triggered during socket lookup",
        })
      );

      dnsLookupSpy.mockRestore();
    });

    it("should pass standard DNS failures through", () => {
      const callback = vi.fn();

      const dnsLookupSpy = vi.spyOn(dns, "lookup").mockImplementation((hostname, options, cb) => {
        (cb as any)(new Error("ENOTFOUND"), null, null);
        return {} as any;
      });

      lookupFn("nonexistent-domain.xyz", {}, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: "ENOTFOUND" }),
        null,
        null
      );

      dnsLookupSpy.mockRestore();
    });
  });

  describe("3. HTTP Integration-test: Route POST Handler", () => {
    describe("Authorization & Security check", () => {
      it("should reject with 401 when user is not authorized", async () => {
        mockGetServerAuthSession.mockResolvedValue(null);

        const req = new Request("http://localhost/api/proxy", {
          body: JSON.stringify({ method: "GET", url: "https://example.com" }),
          method: "POST",
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
        await expect(res.text()).resolves.toBe("Unauthorized");
      });

      it("should reject unsafe protocols directly inside route wrapper", async () => {
        const req = new Request("http://localhost/api/proxy", {
          body: JSON.stringify({ method: "GET", url: "file:///etc/passwd" }),
          method: "POST",
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        await expect(res.text()).resolves.toBe("Forbidden: Unsafe target URL detected");
      });
    });

    describe("Parameters Validation", () => {
      it("should return 400 when url is missing", async () => {
        const req = new Request("http://localhost/api/proxy", {
          body: JSON.stringify({ method: "POST" }),
          method: "POST",
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        await expect(res.text()).resolves.toContain("Missing url or method parameters");
      });

      it("should return 400 when method is missing", async () => {
        const req = new Request("http://localhost/api/proxy", {
          body: JSON.stringify({ url: "https://example.com" }),
          method: "POST",
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        await expect(res.text()).resolves.toContain("Missing url or method parameters");
      });
    });

    describe("Headers Filtering & Body Serializing", () => {
      it("should clean headers before calling fetch", async () => {
        const headers = {
          connection: "close",
          cookie: "session=123",
          host: "bypass-host.com",
          "x-api-key": "test",
        };

        const req = new Request("http://localhost/api/proxy", {
          body: JSON.stringify({ headers, method: "GET", url: "https://example.com" }),
          method: "POST",
        });

        await POST(req);

        expect(globalFetchMock).toHaveBeenCalledWith(
          "https://example.com",
          expect.objectContaining({
            headers: {
              "x-api-key": "test",
            },
          })
        );
      });

      it("should convert object payload to string stringify", async () => {
        const req = new Request("http://localhost/api/proxy", {
          body: JSON.stringify({
            body: { foo: "bar" },
            method: "POST",
            url: "https://example.com",
          }),
          method: "POST",
        });

        await POST(req);

        expect(globalFetchMock).toHaveBeenCalledWith(
          "https://example.com",
          expect.objectContaining({
            body: JSON.stringify({ foo: "bar" }),
            method: "POST",
          })
        );
      });
    });

    describe("SSRF Error Mapping", () => {
      it("should transform undici lookup SSRF error into a 403 API response", async () => {
        // Симулируем выброс ошибки безопасности от нашего ssrfSafeAgent
        globalFetchMock.mockRejectedValue(new Error("Forbidden: Unsafe target IP detected"));

        const req = new Request("http://localhost/api/proxy", {
          body: JSON.stringify({ method: "GET", url: "https://localhost" }),
          method: "POST",
        });

        const res = await POST(req);
        expect(res.status).toBe(403);
        await expect(res.text()).resolves.toBe("Forbidden: Unsafe target URL detected");
      });

      it("should return 502 Proxy Error when fetch fails with generic network errors", async () => {
        globalFetchMock.mockRejectedValue(new Error("Timeout connection"));

        const req = new Request("http://localhost/api/proxy", {
          body: JSON.stringify({ method: "GET", url: "https://example.com" }),
          method: "POST",
        });

        const res = await POST(req);
        expect(res.status).toBe(502);
        await expect(res.text()).resolves.toBe("Proxy Error");

        expect(mockAppLogger.error).toHaveBeenCalledWith({
          error: "Timeout connection",
          msg: "Proxy request failed",
        });
      });
    });
  });
});
