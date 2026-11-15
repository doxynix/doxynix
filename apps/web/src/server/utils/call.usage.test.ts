import { describe, expect, it } from "vitest";

import { estimateTokens } from "./call";

describe("estimateTokens", () => {
  it("caps the reserved output tokens at 8 192", () => {
    // Four characters per estimated token.
    expect(estimateTokens("a".repeat(40), "", 65_536)).toBe(10 + 8192);
  });

  it("reserves the requested output when it is below the cap", () => {
    expect(estimateTokens("a".repeat(40), "", 1000)).toBe(10 + 1000);
  });
});
