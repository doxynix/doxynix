import { bundledThemes } from "shiki/themes";
import { describe, expect, it } from "vitest";

import { CODE_THEMES_DARK, CODE_THEMES_LIGHT } from "./appearance-preferences";

type ThemeModule = { default?: { type?: string }; type?: string };

const LOADERS = bundledThemes as unknown as Record<
  string,
  (() => Promise<ThemeModule>) | undefined
>;
const DARK = new Set<string>(CODE_THEMES_DARK);

describe("code theme classification", () => {
  it("matches the tone Shiki declares for every listed theme", async () => {
    const mismatched: string[] = [];

    for (const id of [...CODE_THEMES_DARK, ...CODE_THEMES_LIGHT]) {
      const load = LOADERS[id];

      if (load == null) {
        mismatched.push(`${id}: not a bundled Shiki theme`);
        continue;
      }

      const mod = await load();
      const declared = mod.type ?? mod.default?.type;
      const expected = DARK.has(id) ? "dark" : "light";

      if (declared !== expected) {
        mismatched.push(`${id}: Shiki says ${String(declared)}, listed as ${expected}`);
      }
    }

    expect(mismatched).toEqual([]);
  });

  it("lists every bundled theme exactly once", () => {
    const listed = [...CODE_THEMES_DARK, ...CODE_THEMES_LIGHT].sort();

    expect(listed).toEqual(Object.keys(bundledThemes).sort());
  });
});
