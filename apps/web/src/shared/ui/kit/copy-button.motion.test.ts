import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const button = readFileSync(join(process.cwd(), "src/shared/ui/kit/copy-button.tsx"), "utf8");

describe("copy button swap", () => {
  it("never collapses an icon to zero", () => {
    expect(button).not.toMatch(/\bscale-0\b/);
  });

  it("enters from a visible scale", () => {
    expect(button).toContain("scale-90");
  });

  it("stays inside the 300ms budget", () => {
    expect(button).not.toMatch(/duration-(3|4|5|6|7|8|9)\d\d/);
  });
});
