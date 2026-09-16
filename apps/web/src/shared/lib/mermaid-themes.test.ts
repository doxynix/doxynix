import { describe, expect, it } from "vitest";

import { mermaidThemes, themeGroups } from "./mermaid-themes";

const REQUIRED_VARIABLES = [
  "background",
  "lineColor",
  "primaryBorderColor",
  "primaryColor",
  "primaryTextColor",
  "secondaryColor",
  "tertiaryColor",
  "textColor",
] as const;

describe("mermaidThemes", () => {
  it("groups every theme exactly once with no duplicates", () => {
    const grouped = themeGroups.flatMap((group) => group.themes);
    expect([...grouped].sort()).toEqual(Object.keys(mermaidThemes).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("defines every required color variable per theme", () => {
    for (const theme of Object.values(mermaidThemes)) {
      for (const variable of REQUIRED_VARIABLES) {
        expect(typeof theme[variable]).toBe("string");
      }
    }
  });

  it("uses hex colors everywhere", () => {
    for (const theme of Object.values(mermaidThemes)) {
      for (const variable of REQUIRED_VARIABLES) {
        expect(theme[variable]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});
