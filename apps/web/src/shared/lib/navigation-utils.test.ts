import { describe, expect, it } from "vitest";

import { isRouteActive } from "@/shared/lib/navigation-utils";

describe("shared/lib/utils:isRouteActive", () => {
  it("returns false for null or undefined href", () => {
    expect(isRouteActive("/repo/foo", null)).toBe(false);
    expect(isRouteActive("/repo/foo", undefined)).toBe(false);
  });

  it("matches exactly when exact is true", () => {
    expect(isRouteActive("/repo/foo", "/repo/foo", true)).toBe(true);
    expect(isRouteActive("/repo/foo/branches", "/repo/foo", true)).toBe(false);
  });

  it("does not apply segment aliases in exact mode", () => {
    expect(isRouteActive("/pulls/5", "/pull/5", true)).toBe(false);
  });

  it("returns false when href is deeper than pathname", () => {
    expect(isRouteActive("/repo", "/repo/foo")).toBe(false);
  });

  it("returns false when segments do not match", () => {
    expect(isRouteActive("/repo/foo/branches", "/repo/bar")).toBe(false);
  });

  it("matches an equal path without the exact flag", () => {
    expect(isRouteActive("/repo/foo", "/repo/foo")).toBe(true);
  });

  it("matches when pathname is at most one segment deeper", () => {
    expect(isRouteActive("/repo/foo/branches", "/repo/foo")).toBe(true);
  });

  it("rejects paths more than one segment deeper for segment-level hrefs", () => {
    expect(isRouteActive("/repo/foo/bar/tree/main", "/repo/foo/bar")).toBe(false);
  });

  it("applies singular/plural segment aliases", () => {
    expect(isRouteActive("/pulls/123", "/pull/123")).toBe(true);
    expect(isRouteActive("/repos/foo", "/repo/foo")).toBe(true);
  });

  it("keeps specific repo hrefs active at any depth", () => {
    expect(isRouteActive("/en/repo/foo/bar/tree/main", "/en/repo/foo/bar")).toBe(true);
  });

  it("treats short hrefs as globally active", () => {
    expect(isRouteActive("/repo/foo/bar/tree/main", "/repo")).toBe(true);
    expect(isRouteActive("/repo/foo/bar/tree/main", "/repo/foo")).toBe(true);
  });

  it("does not highlight a locale-prefixed repos list on repo detail", () => {
    expect(isRouteActive("/en/repo/foo", "/en/repos")).toBe(false);
  });

  it("tolerates trailing slashes", () => {
    expect(isRouteActive("/repo/foo/", "/repo/foo")).toBe(true);
  });
});
