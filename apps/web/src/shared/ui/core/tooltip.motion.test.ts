import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("tooltip motion", () => {
  it("scales from the trigger, not the centre", () => {
    expect(read("src/shared/ui/core/tooltip.tsx")).toContain(
      "origin-(--radix-tooltip-content-transform-origin)",
    );
  });

  it("does not enter from scale zero", () => {
    expect(read("src/shared/ui/core/tooltip.tsx")).not.toContain("zoom-in-0");
  });

  it("uses a 300ms default delay so adjacent tooltips feel immediate", () => {
    expect(read("src/shared/ui/kit/app-tooltip.tsx")).toContain("delay = 300");
  });
});
