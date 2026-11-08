import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("sheet and dialog motion", () => {
  it("never uses ease-in on the sheet exit", () => {
    expect(read("src/shared/ui/core/sheet.tsx")).not.toMatch(/data-\[state=closed\]:ease-in\b/);
  });

  it("closes the sheet faster than it opens", () => {
    const sheet = read("src/shared/ui/core/sheet.tsx");
    expect(sheet).toContain("data-[state=open]:duration-300");
    expect(sheet).toContain("data-[state=closed]:duration-200");
  });

  it("does not animate a blurred overlay", () => {
    expect(read("src/shared/ui/core/sheet.tsx")).not.toContain("backdrop-blur-sm");
    expect(read("src/shared/ui/core/dialog.tsx")).not.toContain("backdrop-blur-sm");
  });

  it("gives the dialog overlay a scrim instead of blur", () => {
    expect(read("src/shared/ui/core/dialog.tsx")).toContain("bg-overlay");
  });
});
