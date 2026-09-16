import { describe, expect, it } from "vitest";

import { getDeltaColorClass } from "./stat-delta";

describe("getDeltaColorClass", () => {
  it("uses muted for a null or undefined delta", () => {
    expect(getDeltaColorClass(null, false)).toBe("text-muted-foreground");
    expect(getDeltaColorClass(undefined, false)).toBe("text-muted-foreground");
  });

  it("uses muted for a zero delta", () => {
    expect(getDeltaColorClass(0, false)).toBe("text-muted-foreground");
  });

  it("maps positive to success and negative to destructive", () => {
    expect(getDeltaColorClass(5, false)).toBe("text-success");
    expect(getDeltaColorClass(-5, false)).toBe("text-destructive");
  });

  it("reverses the colors with reverseColor", () => {
    expect(getDeltaColorClass(5, true)).toBe("text-destructive");
    expect(getDeltaColorClass(-5, true)).toBe("text-success");
  });
});
