import { describe, expect, it } from "vitest";

import { isPathname, safeInternalPath } from "./safe-redirect";

describe("safeInternalPath", () => {
  it.each([
    ["//evil.com"],
    ["/\\evil.com"],
    ["/\t/evil.com"],
    ["/\n/evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
    [""],
    ["dashboard"],
  ])("rejects %j", (value) => {
    expect(safeInternalPath(value)).toBe("/dashboard");
  });

  it("keeps internal paths with query and hash", () => {
    expect(safeInternalPath("/invite/abc")).toBe("/invite/abc");
    expect(safeInternalPath("/dashboard?tab=usage#top")).toBe("/dashboard?tab=usage#top");
  });

  it("normalizes dot segments", () => {
    expect(safeInternalPath("/a/../b")).toBe("/b");
  });

  it("falls back for arrays and undefined", () => {
    expect(safeInternalPath(["/a", "/b"])).toBe("/dashboard");
    expect(safeInternalPath(undefined)).toBe("/dashboard");
  });
});

describe("isPathname", () => {
  it("ignores query and hash", () => {
    expect(isPathname("/dashboard?tab=x", "/dashboard")).toBe(true);
    expect(isPathname("/dashboardish", "/dashboard")).toBe(false);
    expect(isPathname("http://[", "/dashboard")).toBe(false);
  });
});
