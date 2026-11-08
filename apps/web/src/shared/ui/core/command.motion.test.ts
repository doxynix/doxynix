import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("command palette motion", () => {
  it("exposes an animated escape hatch on DialogContent", () => {
    expect(read("src/shared/ui/core/dialog.tsx")).toContain("animated = true");
    expect(read("src/shared/ui/core/dialog.tsx")).toContain("animated?: boolean");
  });

  it("opens the palette with no animation at all", () => {
    expect(read("src/shared/ui/core/command.tsx")).toContain("animated={false}");
  });

  it("keeps the normal dialog animated", () => {
    expect(read("src/shared/ui/core/dialog.tsx")).toContain("data-[state=open]:duration-300");
  });
});
