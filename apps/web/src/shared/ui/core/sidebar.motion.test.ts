import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sidebar = readFileSync(join(process.cwd(), "src/shared/ui/core/sidebar.tsx"), "utf8");

describe("sidebar motion", () => {
  it("does not animate left and right", () => {
    expect(sidebar).not.toContain("transition-[left,right,width]");
  });

  it("slides the offcanvas state with translate", () => {
    expect(sidebar).toContain("transition-[width,translate]");
    expect(sidebar).toContain("group-data-[collapsible=offcanvas]:-translate-x-full");
    expect(sidebar).toContain("group-data-[collapsible=offcanvas]:translate-x-full");
  });
});
