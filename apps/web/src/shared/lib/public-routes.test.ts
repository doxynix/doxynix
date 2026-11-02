import { describe, expect, it } from "vitest";

import { PUBLIC_ROUTES } from "./public-routes";

describe("PUBLIC_ROUTES", () => {
  it("should expose unique, normalized paths", () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);

    expect(new Set(paths).size).toBe(paths.length);

    for (const path of paths) {
      expect(path.startsWith("/")).toBe(false);
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("should keep the legal pages in the inventory", () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);

    expect(paths).toEqual(expect.arrayContaining(["", "about", "support", "privacy", "terms"]));
  });

  it("should keep priorities inside the sitemap range", () => {
    for (const route of PUBLIC_ROUTES) {
      expect(route.priority).toBeGreaterThan(0);
      expect(route.priority).toBeLessThanOrEqual(1);
    }
  });
});
