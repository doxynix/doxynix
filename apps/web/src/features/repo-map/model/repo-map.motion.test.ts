import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const curve = "cubic-bezier(0.23, 1, 0.32, 1)";

describe("repo map hover", () => {
  it("dims edges in 120ms on the shared curve", () => {
    expect(read("src/features/repo-map/model/use-map-layout.ts")).toContain(
      `transition: "opacity 120ms ${curve}"`,
    );
    expect(read("src/features/repo-map/model/repo-map-hover.ts")).toContain(
      `transition: "opacity 120ms ${curve}"`,
    );
  });

  it("dims nodes fast enough for a hover", () => {
    const node = read("src/features/repo-map/ui/repo-node.tsx");
    expect(node).toContain("transition-opacity duration-150");
    expect(node).not.toContain("duration-300 ease-in-out");
  });

  it("drops the dead opacity transition", () => {
    expect(read("src/features/repo-map/ui/repo-map.tsx")).not.toContain(
      'className={cn("transition-opacity duration-300")}',
    );
  });
});
