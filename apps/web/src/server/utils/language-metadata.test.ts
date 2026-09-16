import { describe, expect, it, vi } from "vitest";

import { getLanguageColor, normalizeLanguageName } from "@/server/utils/language-metadata";

vi.mock("linguist-languages", () => ({
  JavaScript: {
    color: "#f1e05a",
    extensions: [".js", ".jsx"],
  },
  TypeScript: {
    color: "#3178c6",
    extensions: [".ts", ".tsx"],
  },
}));

describe("shared/lib/utils:getLanguageColor", () => {
  it("should return fallback color for null and unknown language", () => {
    expect(getLanguageColor(null)).toBe("#cccccc");
    expect(getLanguageColor("VeryUnknownLanguage")).toBe("#cccccc");
  });

  it("should resolve color by exact name, extension and case-insensitive name", () => {
    expect(getLanguageColor("TypeScript")).toBe("#3178c6");
    expect(getLanguageColor("ts")).toBe("#3178c6");
    expect(getLanguageColor("typescript")).toBe("#3178c6");
  });
});

describe("shared/lib/utils:normalizeLanguageName", () => {
  it("should normalize known extension and uppercase unknown one", () => {
    expect(normalizeLanguageName("ts")).toBe("TypeScript");
    expect(normalizeLanguageName("abc")).toBe("ABC");
  });
});
