import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const LEGACY_CURVES = [
  "cubic-bezier(0.4, 0, 0.2, 1)",
  "cubic-bezier(0.25, 0.8, 0.25, 1)",
  "cubic-bezier(0.4, 0, 1, 1)",
];

const files = walk(SRC)
  .filter((file) => /\.(tsx?|css)$/.test(file))
  .filter((file) => !file.includes(".test."))
  .map((file) => relative(process.cwd(), file));

describe("curve consolidation", () => {
  for (const curve of LEGACY_CURVES) {
    it(`does not hardcode ${curve}`, () => {
      const offenders = files.filter((file) =>
        readFileSync(join(process.cwd(), file), "utf8").includes(curve),
      );
      expect(offenders).toEqual([]);
    });
  }
});
