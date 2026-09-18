import { describe, expect, it } from "vitest";

import { nextTypingLength } from "./use-typewriter";

describe("nextTypingLength", () => {
  it("should advance one plain character at a time", () => {
    expect(nextTypingLength("abc", 0)).toBe(1);
    expect(nextTypingLength("abc", 1)).toBe(2);
    expect(nextTypingLength("hello", 1)).toBe(2);
  });

  it("should skip a whole tag plus one character in a single tick", () => {
    expect(nextTypingLength("<b>hi", 0)).toBe(4);
  });

  it("should skip a whole HTML entity plus the following character", () => {
    expect(nextTypingLength("&amp;x", 0)).toBe(6);
  });

  it("should not fast-forward long or dangling entities", () => {
    expect(nextTypingLength("&abcdefghijkl;z", 0)).toBe(2);
    expect(nextTypingLength("< ", 0)).toBe(2);
  });

  it("should chain consecutive tags and entities in one tick", () => {
    expect(nextTypingLength("<b>&amp;</b>", 0)).toBe(12);
  });
});
