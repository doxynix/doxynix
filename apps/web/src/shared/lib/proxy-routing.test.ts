import { describe, expect, it } from "vitest";

import { API_PREFIX } from "@/shared/config/env.client";
import { hasPathBoundary, isBypassRoute, resolvePageRedirect } from "@/shared/lib/proxy-routing";

describe("shared/lib/middleware-routing:hasPathBoundary", () => {
  it("matches the exact prefix", () => {
    expect(hasPathBoundary("/dashboard", "/dashboard")).toBe(true);
  });

  it("matches the prefix followed by a slash", () => {
    expect(hasPathBoundary("/dashboard/analytics", "/dashboard")).toBe(true);
  });

  it("rejects a mere string prefix of the path", () => {
    expect(hasPathBoundary("/dashboardx", "/dashboard")).toBe(false);
  });

  it("rejects unrelated paths", () => {
    expect(hasPathBoundary("/auth", "/dashboard")).toBe(false);
  });

  it("matches deeper nested paths with the same boundary", () => {
    expect(hasPathBoundary("/api/webhooks/github/event", "/api/webhooks")).toBe(true);
  });
});

describe("shared/lib/middleware-routing:isBypassRoute", () => {
  it("bypasses exact static paths", () => {
    for (const path of [
      "/favicon.ico",
      "/manifest.json",
      "/manifest.webmanifest",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      expect(isBypassRoute(path)).toBe(true);
    }
  });

  it("bypasses /vitals suffixes", () => {
    expect(isBypassRoute("/vitals")).toBe(true);
    expect(isBypassRoute("/some/route/vitals")).toBe(true);
    expect(isBypassRoute("/vitalsx")).toBe(false);
  });

  it("bypasses protected prefixes", () => {
    expect(isBypassRoute("/api/webhooks/github")).toBe(true);
    expect(isBypassRoute("/webhooks/sync")).toBe(true);
    expect(isBypassRoute("/api/auth/session")).toBe(true);
    expect(isBypassRoute("/_axiom/log")).toBe(true);
  });

  it("bypasses analytics tunnels composed with API_PREFIX", () => {
    expect(isBypassRoute(`${API_PREFIX}/dxnx/p`)).toBe(true);
    expect(isBypassRoute(`${API_PREFIX}/dxnx/s`)).toBe(true);
    expect(isBypassRoute(`${API_PREFIX}/dxnx/other`)).toBe(false);
  });

  it("respects path boundaries for prefixes", () => {
    expect(isBypassRoute("/api/webhooksx")).toBe(false);
    expect(isBypassRoute("/webhooksx")).toBe(false);
    expect(isBypassRoute("/api/authx")).toBe(false);
    expect(isBypassRoute(`${API_PREFIX}/dxnx-other`)).toBe(false);
  });

  it("does not bypass ordinary pages", () => {
    expect(isBypassRoute("/dashboard")).toBe(false);
    expect(isBypassRoute("/map")).toBe(false);
  });
});

describe("shared/lib/middleware-routing:resolvePageRedirect", () => {
  it("redirects a protected page to /auth without a token", () => {
    expect(resolvePageRedirect("/dashboard", false)).toBe("/auth");
    expect(resolvePageRedirect("/dashboard/analytics", false)).toBe("/auth");
  });

  it("preserves the locale prefix in the redirect", () => {
    expect(resolvePageRedirect("/en/dashboard", false)).toBe("/en/auth");
    expect(resolvePageRedirect("/ru/dashboard/analytics", false)).toBe("/ru/auth");
    expect(resolvePageRedirect("/zh-CN/dashboard", false)).toBe("/zh-CN/auth");
  });

  it("redirects an auth page to /dashboard with a token", () => {
    expect(resolvePageRedirect("/auth", true)).toBe("/dashboard");
    expect(resolvePageRedirect("/de/auth", true)).toBe("/de/dashboard");
  });

  it("keeps authed users out of /dashboard and anonymous users out of /auth", () => {
    expect(resolvePageRedirect("/dashboard", true)).toBeNull();
    expect(resolvePageRedirect("/auth", false)).toBeNull();
  });

  it("respects path boundaries", () => {
    expect(resolvePageRedirect("/dashboardx", false)).toBeNull();
    expect(resolvePageRedirect("/authx", true)).toBeNull();
  });

  it("ignores unrelated pages regardless of token", () => {
    expect(resolvePageRedirect("/about", false)).toBeNull();
    expect(resolvePageRedirect("/privacy", true)).toBeNull();
  });

  it("treats a partial locale match as a path prefix, not a locale (legacy behavior)", () => {
    expect(resolvePageRedirect("/en-US/dashboard", false)).toBeNull();
  });
});
