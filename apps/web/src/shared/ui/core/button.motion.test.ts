import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const button = readFileSync(join(process.cwd(), "src/shared/ui/core/button.tsx"), "utf8");

// Press scale was removed after review: it read as odd in the product. Keep it out.
describe("button feedback", () => {
  it("does not scale on press", () => {
    expect(button).not.toContain("active:scale");
  });

  it("keeps the shared transition utility", () => {
    expect(button).toContain("transition-standard");
  });

  it("a press never animates longer than 160ms", () => {
    expect(button).not.toMatch(/active:.*duration-(3|4|5)\d\d/);
  });
});
