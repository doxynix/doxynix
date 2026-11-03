import { describe, expect, it } from "vitest";

import {
  matchesSearchTerm,
  normalizeSearchInput,
  tokenizeSearchInput,
} from "@/server/utils/search";

describe("search utils", () => {
  it("should normalize raw search input", () => {
    expect(normalizeSearchInput("  React-Query  ")).toBe("react-query");
  });

  it("should tokenize GitHub-style developer queries", () => {
    expect(tokenizeSearchInput("  @TanStack/react-query  ")).toEqual([
      "tanstack",
      "react",
      "query",
    ]);
  });

  it("should stay neutral and just split by separators", () => {
    expect(tokenizeSearchInput("C++ C# .NET node.js next.js")).toEqual([
      "net",
      "node",
      "js",
      "next",
    ]);
  });

  it("should preserve raw punctuation search even when tokens are filtered out", () => {
    expect(normalizeSearchInput(" C++ ")).toBe("c++");
    expect(tokenizeSearchInput(" C++ ")).toEqual([]);
  });

  it("matches normalized terms against NFC and NFD values", () => {
    const nfc = "Caf\u00E9@Example.com";
    const nfd = "cafe\u0301@example.com";
    const term = normalizeSearchInput("cafe\u0301");

    expect(term).toBeDefined();
    expect(matchesSearchTerm(nfc, term as string)).toBe(true);
    expect(matchesSearchTerm(nfd, term as string)).toBe(true);
  });
});
