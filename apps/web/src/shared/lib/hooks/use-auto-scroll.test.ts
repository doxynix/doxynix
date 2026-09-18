import { describe, expect, it } from "vitest";

import { isNearBottom } from "./use-auto-scroll";

describe("isNearBottom", () => {
  it("should accurately detect when the scroll position is within the 15px threshold from the bottom", () => {
    expect(isNearBottom(500, 0, 400)).toBe(false);
    expect(isNearBottom(500, 480, 20)).toBe(true);
    expect(isNearBottom(500, 491, 10)).toBe(true);
    expect(isNearBottom(1000, 900, 85)).toBe(false);
    expect(isNearBottom(1000, 901, 85)).toBe(true);
  });
});
