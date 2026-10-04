import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  anonymizeIp,
  deriveProcedureStore,
  getCountry,
  getIp,
  getUa,
  requestContext,
  withProcedureContext,
} from "./request-context";

type RequestExtras = {
  geo?: {
    country?: string;
  };
  ip?: string;
};

function createRequest(
  headers: Record<string, string> = {},
  extras: RequestExtras = {},
): NextRequest {
  return {
    ...extras,
    headers: new Headers(headers),
  } as NextRequest;
}

describe("request-context utils", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/shared/config/env.flags");
  });

  describe("anonymizeIp", () => {
    it("should keep local addresses and return null for unknown", () => {
      expect(anonymizeIp(null)).toBeNull();
      expect(anonymizeIp("unknown")).toBeNull();
      expect(anonymizeIp("127.0.0.1")).toBe("127.0.0.1");
      expect(anonymizeIp("::1")).toBe("::1");
    });

    it("should anonymize ipv4 and ipv6 addresses", () => {
      expect(anonymizeIp("192.168.10.22")).toBe("192.168.10.0");

      const inputIpv6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
      const expectedIpv6 = "2001:db8:85a3:0:0:0:0:0";
      expect(anonymizeIp(inputIpv6)).toBe(expectedIpv6);
    });

    it("should return null for invalid ip format", () => {
      expect(anonymizeIp("1:2:3")).toBeNull();
      expect(anonymizeIp("invalid-ip")).toBeNull();
    });
  });

  describe("getIp", () => {
    it("should use request.ip when present", () => {
      const request = createRequest({}, { ip: "10.10.10.10" });

      expect(getIp(request)).toBe("10.10.10.10");
    });

    it("should fallback to x-forwarded-for first entry", () => {
      const request = createRequest({
        "x-forwarded-for": "8.8.8.8, 1.1.1.1",
      });

      expect(getIp(request)).toBe("8.8.8.8");
    });

    it("should fallback to localhost when no ip info provided", () => {
      const request = createRequest();

      expect(getIp(request)).toBe("127.0.0.1");
    });
  });

  describe("getUa", () => {
    it("should return user-agent header when present", () => {
      const request = createRequest({
        "user-agent": "Mozilla/5.0",
      });

      expect(getUa(request)).toBe("Mozilla/5.0");
    });

    it("should return unknown when user-agent header is missing", () => {
      const request = createRequest();

      expect(getUa(request)).toBe("unknown");
    });
  });

  describe("getCountry", () => {
    it("should prioritize geo country when available", () => {
      const request = createRequest({}, { geo: { country: "DE" } });

      expect(getCountry(request)).toBe("DE");
    });

    it("should use x-vercel-ip-country header and uppercase value", () => {
      const request = createRequest({
        "x-vercel-ip-country": "pl",
      });

      expect(getCountry(request)).toBe("PL");
    });

    it("should return LOCAL in non-production mode when no country info exists", () => {
      const request = createRequest();

      expect(getCountry(request)).toBe("LOCAL");
    });
  });

  it("should return UNKNOWN in production when geo and headers are missing", async () => {
    vi.doMock("@/shared/config/env.flags", () => ({
      IS_PROD: true,
    }));

    const { getCountry } = await import("@/server/utils/request-context");

    expect(getCountry(createRequest())).toBe("UNKNOWN");
  });
});

describe("withProcedureContext", () => {
  function makeParent() {
    return deriveProcedureStore(
      {
        country: "LOCAL",
        ip: "203.0.113.0",
        method: "query",
        path: "/api/trpc",
        requestId: "req-1",
        userAgent: "vitest",
      },
      { method: "batch", path: "/api/trpc" },
    );
  }

  it("keeps concurrent procedures from clobbering each other's path", async () => {
    const parent = makeParent();

    const readPath = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return requestContext.getStore()?.path;
    };

    const [a, b] = await Promise.all([
      withProcedureContext(parent, { method: "query", path: "analytics.getTrends" }, readPath),
      withProcedureContext(parent, { method: "query", path: "repo.getAll" }, readPath),
    ]);

    expect(a).toBe("analytics.getTrends");
    expect(b).toBe("repo.getAll");
  });

  it("does not mutate the parent store", () => {
    const parent = makeParent();

    withProcedureContext(parent, { method: "query", path: "notification.getAll" }, () => null);

    expect(parent.path).toBe("/api/trpc");
  });

  it("preserves request-scoped fields from the parent", () => {
    const parent = makeParent();

    const child = deriveProcedureStore(parent, {
      method: "mutation",
      path: "repo.create",
      userId: "user-1",
      userRole: "USER",
    });

    expect(child.requestId).toBe("req-1");
    expect(child.ip).toBe("203.0.113.0");
    expect(child.userAgent).toBe("vitest");
    expect(child.method).toBe("mutation");
    expect(child.path).toBe("repo.create");
    expect(child.userId).toBe("user-1");
    expect(child.userRole).toBe("USER");
  });

  it("lets a procedure override the authenticated user on the store", () => {
    const parent = makeParent();

    const child = deriveProcedureStore(parent, {
      method: "query",
      path: "user.me",
      userId: "user-2",
    });

    expect(child.userId).toBe("user-2");
  });
});
