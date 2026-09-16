// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getClientCookie, setClientCookie } from "@/shared/lib/cookies";

describe("shared/lib/cookies", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", {
      value: "",
      writable: true,
    });
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("getClientCookie", () => {
    it("should return null if cookie is not found", () => {
      document.cookie = "other_token=12345; user=john";

      expect(getClientCookie("non_existent")).toBeNull();
    });

    it("should extract and decode cookie value correctly", () => {
      document.cookie = `session_id=${encodeURIComponent("hello world & special=true")}`;

      expect(getClientCookie("session_id")).toBe("hello world & special=true");
    });

    it("should correctly find cookie regardless of position in cookie string", () => {
      document.cookie = "first=1; target_cookie=expected_value; last=3";

      expect(getClientCookie("target_cookie")).toBe("expected_value");
      expect(getClientCookie("first")).toBe("1");
      expect(getClientCookie("last")).toBe("3");
    });

    it("should escape special regex characters in cookie name", () => {
      const specialName = "user[id].token$";
      document.cookie = `${specialName}=secret_val; other=1`;

      expect(getClientCookie(specialName)).toBe("secret_val");
    });

    it("should return null in SSR environment (window is undefined)", () => {
      vi.stubGlobal("window", undefined);

      expect(getClientCookie("any_cookie")).toBeNull();
    });
  });

  describe("setClientCookie", () => {
    it("should set cookie with Secure flag on HTTPS", () => {
      Object.defineProperty(window, "location", {
        value: { protocol: "https:" },
        writable: true,
      });

      setClientCookie("auth_token", "secret_123", 3600);

      expect(document.cookie).toContain("auth_token=secret_123");
      expect(document.cookie).toContain("max-age=3600");
      expect(document.cookie).toContain("path=/");
      expect(document.cookie).toContain("SameSite=Lax");
      expect(document.cookie).toContain("Secure;");
    });

    it("should set cookie without Secure flag on HTTP", () => {
      Object.defineProperty(window, "location", {
        value: { protocol: "http:" },
        writable: true,
      });

      setClientCookie("dev_token", "test_val", 1800);

      expect(document.cookie).toContain("dev_token=test_val");
      expect(document.cookie).toContain("max-age=1800");
      expect(document.cookie).not.toContain("Secure;");
    });

    it("should properly serialize and encode boolean values and special characters", () => {
      Object.defineProperty(window, "location", {
        value: { protocol: "https:" },
        writable: true,
      });

      setClientCookie("is_active", true, 600);
      expect(document.cookie).toContain("is_active=true");

      setClientCookie("complex_value", "foo bar/baz?qux", 600);
      expect(document.cookie).toContain(`complex_value=${encodeURIComponent("foo bar/baz?qux")}`);
    });

    it("should do nothing in SSR environment (window is undefined)", () => {
      vi.stubGlobal("window", undefined);

      expect(() => {
        setClientCookie("ssr_token", "val", 3600);
      }).not.toThrow();
    });
  });

  describe("getCookieName", () => {
    it("should return secure cookie name in production mode", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const { getCookieName: getProdCookieName } = await import("@/shared/lib/cookies");

      expect(getProdCookieName()).toBe("__Secure-doxynix.session_token");
    });

    it("should return standard cookie name in development mode", async () => {
      vi.stubEnv("NODE_ENV", "development");

      const { getCookieName: getDevCookieName } = await import("@/shared/lib/cookies");

      expect(getDevCookieName()).toBe("doxynix.session_token");
    });
  });
});
