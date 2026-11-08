import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const header = readFileSync(
  join(process.cwd(), "src/widgets/public-header/ui/public-header-wrapper.tsx"),
  "utf8",
);

describe("public header motion", () => {
  it("reads the reduced-motion preference", () => {
    expect(header).toContain("useReducedMotion");
  });

  it("does not translate when motion is reduced", () => {
    expect(header).toContain('y: reduceMotion ? 0 : "-100%"');
  });
});
