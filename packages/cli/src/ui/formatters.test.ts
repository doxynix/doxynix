import { describe, expect, it } from "vitest";

import {
  formatScore,
  getScoreLabel,
  getStringWidth,
  parseDateArg,
  stripAnsi,
  stripHtml,
} from "./formatters";

describe("stripAnsi", () => {
  it("removes SGR sequences", () => {
    expect(stripAnsi("\u001B[31mred\u001B[39m")).toBe("red");
  });

  it("leaves plain text untouched", () => {
    expect(stripAnsi("plain")).toBe("plain");
  });
});

describe("getStringWidth", () => {
  it("counts plain ASCII as one column per character", () => {
    expect(getStringWidth("abc")).toBe(3);
  });

  it("ignores ANSI sequences when measuring", () => {
    expect(getStringWidth("\u001B[31mabc\u001B[39m")).toBe(3);
  });

  it("returns zero for an empty string", () => {
    expect(getStringWidth("")).toBe(0);
  });

  it("counts a CJK character as two columns", () => {
    expect(getStringWidth("日本")).toBe(4);
  });

  it("treats a variation selector as zero width", () => {
    expect(getStringWidth("✈\uFE0F")).toBe(1);
  });
});

describe("stripHtml", () => {
  it("drops tags and decodes entities", () => {
    expect(stripHtml("<p>Hello &amp; goodbye</p>")).toBe("Hello & goodbye");
  });

  it("converts break tags to newlines", () => {
    expect(stripHtml("a<br>b")).toBe("a\nb");
  });

  it("returns an empty string for tag-only input", () => {
    expect(stripHtml("<div></div>")).toBe("");
  });
});

describe("formatScore", () => {
  it.each([
    [95, "95/100"],
    [80, "80/100"],
    [50, "50/100"],
    [10, "10/100"],
  ])("renders %s as %s", (score, expected) => {
    expect(stripAnsi(formatScore(score))).toBe(expected);
  });

  it("renders a dash for null", () => {
    expect(stripAnsi(formatScore(null))).toBe("—");
  });

  it("renders a dash for undefined", () => {
    expect(stripAnsi(formatScore(undefined))).toBe("—");
  });
});

describe("getScoreLabel", () => {
  it.each([
    [95, "Excellent"],
    [80, "Excellent"],
    [65, "Needs Attention"],
    [50, "Needs Attention"],
    [12, "Critical"],
  ])("labels %s as %s", (score, expected) => {
    expect(stripAnsi(getScoreLabel(score))).toBe(expected);
  });

  it("labels a missing score as no data", () => {
    expect(stripAnsi(getScoreLabel(null))).toBe("No data");
  });
});

describe("parseDateArg", () => {
  it("parses an ISO date", () => {
    expect(parseDateArg("2026-01-15T10:00:00Z")).toBeInstanceOf(Date);
  });

  it("returns undefined for an unparseable value", () => {
    expect(parseDateArg("not-a-date")).toBeUndefined();
  });

  it("returns undefined for an empty or absent value", () => {
    expect(parseDateArg(undefined)).toBeUndefined();
    expect(parseDateArg("   ")).toBeUndefined();
  });
});
