/* eslint-disable sonarjs/no-hardcoded-ip */
import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { anonymizeIp, getCountry, getIp, getUa } from "@/server/utils/request-context";

type RequestExtras = {
  geo?: {
    country?: string;
  };
  ip?: string;
};

function createRequest(
  headers: Record<string, string> = {},
  extras: RequestExtras = {}
): NextRequest {
  return {
    ...extras,
    headers: new Headers(headers),
  } as NextRequest;
}

describe("request-context utils", () => {
  describe("anonymizeIp", () => {
    it("should keep local and unknown addresses unchanged", () => {
      expect(anonymizeIp(null)).toBe("unknown");
      expect(anonymizeIp("unknown")).toBe("unknown");
      expect(anonymizeIp("127.0.0.1")).toBe("127.0.0.1");
      expect(anonymizeIp("::1")).toBe("::1");
    });

    it("should anonymize ipv4 and ipv6 addresses", () => {
      expect(anonymizeIp("192.168.10.22")).toBe("192.168.10.0");
      expect(anonymizeIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:0db8:85a3:0000::");
    });

    it("should return unknown for invalid ip format", () => {
      expect(anonymizeIp("1:2:3")).toBe("unknown");
      expect(anonymizeIp("invalid-ip")).toBe("unknown");
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
});
