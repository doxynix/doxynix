import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const file = readFileSync(
  join(process.cwd(), "src/shared/ui/core/animated-circular-progress-bar.tsx"),
  "utf8",
);

describe("circular gauge motion", () => {
  it("never transitions every property", () => {
    expect(file).not.toContain('transition: "all');
    expect(file).not.toContain("transition: `all");
  });

  it("animates only the arc length", () => {
    expect(file).toContain('transitionProperty: "stroke-dasharray"');
  });

  it("settles inside half a second", () => {
    expect(file).toContain('"--transition-length": "400ms"');
  });
});
