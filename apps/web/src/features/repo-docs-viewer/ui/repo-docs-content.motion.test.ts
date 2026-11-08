import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("dashboard micro-motion", () => {
  it("swaps doc content inside the budget", () => {
    const docs = read("src/features/repo-docs-viewer/ui/repo-docs-content.tsx");
    expect(docs).toContain("animate-in duration-200");
    expect(docs).not.toContain("duration-500");
  });

  it("does not pulse a static status icon", () => {
    expect(read("src/entities/repo/ui/repo-status-bar.tsx")).not.toContain("animate-pulse");
    expect(read("src/entities/repo/ui/repo-analytics-cards.tsx")).not.toContain("animate-pulse");
  });

  it("fades a mounted diagram inside the budget", () => {
    const mermaid = read("src/shared/ui/core/mermaid.tsx");
    expect(mermaid).toContain("duration-200");
    expect(mermaid).not.toContain("duration-300");
  });
});
