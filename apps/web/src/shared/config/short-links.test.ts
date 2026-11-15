import { describe, expect, it } from "vitest";

import { HELP_SHORT_LINKS, SHORT_LINKS } from "./short-links";

describe("short links", () => {
  it("keeps every help short link backed by a redirect", () => {
    const sources = new Set(SHORT_LINKS.map((link) => link.source));

    for (const link of HELP_SHORT_LINKS) {
      expect(sources.has(link.path)).toBe(true);
    }
  });

  it("does not register the same source twice", () => {
    const sources = SHORT_LINKS.map((link) => link.source);

    expect(new Set(sources).size).toBe(sources.length);
  });
});
