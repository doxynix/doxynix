import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src/shared/ui");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = walk(ROOT)
  .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"))
  .filter((file) => !file.includes(".test."))
  .map((file) => relative(ROOT, file));

const RULES = [
  { name: "transition-all", pattern: /\btransition-all\b/ },
  { name: "ease-in", pattern: /\bease-in\b(?!-out)/ },
  { name: "scale(0) entrance", pattern: /\bscale-0\b/ },
  { name: "UI duration over 300ms", pattern: /duration-[4-9]\d\d\b/ },
  { name: "transition: all", pattern: /transition:\s*["'`]all\b/ },
];

describe("motion policy", () => {
  for (const rule of RULES) {
    it(`has no ${rule.name} in shared/ui`, () => {
      const offenders = sources.filter((file) =>
        rule.pattern.test(readFileSync(join(ROOT, file), "utf8")),
      );
      expect(offenders).toEqual([]);
    });
  }

  // tw-animate defaults animation-fill-mode to none, so an unpinned exit repaints one frame of the
  // open state between animationend and Radix unmounting the element.
  it("pins the final frame of every exit animation", () => {
    const offenders = sources.filter((file) => {
      const source = readFileSync(join(ROOT, file), "utf8");
      const exits = source.match(/\banimate-out\b/g)?.length ?? 0;
      const pinned = source.match(/\bfill-mode-forwards\b/g)?.length ?? 0;
      return exits > pinned;
    });

    expect(offenders).toEqual([]);
  });
});
