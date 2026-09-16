import { describe, expect, it } from "vitest";

import { getHealthClasses, getHealthColor } from "./get-health-color";

describe("getHealthColor", () => {
  it("returns destructive below 50", () => {
    expect(getHealthColor(0)).toBe("var(--destructive)");
    expect(getHealthColor(49)).toBe("var(--destructive)");
    expect(getHealthColor(-10)).toBe("var(--destructive)");
  });

  it("returns warning from 50 to 79", () => {
    expect(getHealthColor(50)).toBe("var(--status-warning)");
    expect(getHealthColor(79)).toBe("var(--status-warning)");
  });

  it("returns success from 80 up", () => {
    expect(getHealthColor(80)).toBe("var(--status-success)");
    expect(getHealthColor(100)).toBe("var(--status-success)");
  });
});

describe("getHealthClasses", () => {
  it("uses destructive classes below 50", () => {
    expect(getHealthClasses(49)).toBe("text-destructive bg-destructive/10");
  });

  it("uses warning classes from 50 to 79", () => {
    expect(getHealthClasses(50)).toBe("text-warning bg-warning/10");
    expect(getHealthClasses(79)).toBe("text-warning bg-warning/10");
  });

  it("uses success classes from 80 up", () => {
    expect(getHealthClasses(80)).toBe("text-success bg-success/10");
    expect(getHealthClasses(100)).toBe("text-success bg-success/10");
  });
});
