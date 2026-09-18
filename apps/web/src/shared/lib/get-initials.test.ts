import { describe, expect, it } from "vitest";

import { getInitials } from "./get-initials";

// Matches unpaired UTF-16 surrogates: a high surrogate not followed by a low one,
// or a low surrogate not preceded by a high one.
const NO_LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe("getInitials", () => {
  it("returns initials for names with two or more words", () => {
    expect(getInitials("Ada Lovelace Byron")).toBe("AL");
  });

  it("returns one letter for a single-word name", () => {
    expect(getInitials("Cher")).toBe("C");
  });

  it("trims extra spaces before extracting initials", () => {
    expect(getInitials("   Alan    Turing   ")).toBe("AT");
  });

  it("supports Cyrillic names", () => {
    expect(getInitials("Иван Петров")).toBe("ИП");
  });

  it("takes the first character for CJK names (no uppercase concept)", () => {
    expect(getInitials("张三")).toBe("张");
  });

  it("handles RTL scripts without case", () => {
    expect(getInitials("محمد علي")).toBe("مع");
  });

  it("does not split Devanagari conjunct clusters", () => {
    expect(getInitials("राम प्रसाद")).toBe("राप्र");
  });

  it("keeps emoji intact instead of emitting a lone surrogate", () => {
    expect(getInitials("😀 User")).toBe("😀U");
  });

  it("never emits lone surrogates for ZWJ emoji sequences", () => {
    const result = getInitials("👨👩👧👦 Dev");
    expect(result.endsWith("D")).toBe(true);
    expect(NO_LONE_SURROGATE.test(result)).toBe(false);
  });

  it("uppercases per locale (Turkish dotted capital I)", () => {
    expect(getInitials("ilker yılmaz", undefined, "tr")).toBe("İY");
    expect(getInitials("ilker yılmaz")).toBe("IY");
  });

  it("falls back to email initial when name is missing", () => {
    expect(getInitials(null, "bob@example.com")).toBe("B");
    expect(getInitials(undefined, "alice@example.com")).toBe("A");
  });

  it("returns U when both name and email are missing", () => {
    expect(getInitials(null, null)).toBe("U");
    expect(getInitials(undefined, undefined)).toBe("U");
  });
});
