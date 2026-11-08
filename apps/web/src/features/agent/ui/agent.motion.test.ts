import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const agent = readFileSync(join(process.cwd(), "src/features/agent/ui/agent.tsx"), "utf8");

describe("agent panel motion", () => {
  it("never tweens layout offsets", () => {
    expect(agent).not.toMatch(/animate=\{\{\s*bottom:/);
    expect(agent).not.toMatch(/initial=\{\{\s*bottom:/);
  });

  it("snaps the geometry through style instead", () => {
    expect(agent).toContain("style={insets}");
  });

  it("drops the slide under reduced motion", () => {
    expect(agent).toContain("useReducedMotion");
    expect(agent).toContain("reduceMotion ? 0 : 8");
  });

  it("does not run a 450ms tween", () => {
    expect(agent).not.toMatch(/duration: 0\.45/);
  });
});
