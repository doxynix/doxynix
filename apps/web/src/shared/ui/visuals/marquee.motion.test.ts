import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const marquee = readFileSync(join(process.cwd(), "src/shared/ui/visuals/marquee.tsx"), "utf8");

describe("marquee", () => {
  it("reverses with animation-direction, not the invalid direction property", () => {
    expect(marquee).not.toContain("direction-[reverse]");
    expect(marquee).toContain("[animation-direction:reverse]");
  });
});
