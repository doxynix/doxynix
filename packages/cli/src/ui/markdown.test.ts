import { beforeEach, describe, expect, it } from "vitest";

import { stripAnsi } from "@/ui/formatters";

import { renderInlineMarkdown, renderMarkdownLine, resetMarkdownState } from "./markdown";

beforeEach(() => {
  resetMarkdownState();
});

describe("renderMarkdownLine", () => {
  it("never renders the text 'undefined' for a blank line", () => {
    expect(stripAnsi(renderMarkdownLine(""))).not.toContain("undefined");
  });

  it("renders a whitespace-only line as whitespace, not 'undefined'", () => {
    expect(stripAnsi(renderMarkdownLine("   "))).not.toContain("undefined");
  });

  it("returns a string type for empty input", () => {
    expect(typeof renderMarkdownLine("")).toBe("string");
  });

  it("preserves plain text", () => {
    expect(stripAnsi(renderMarkdownLine("hello world"))).toBe("hello world");
  });

  it("renders a bullet with the magenta marker and stripped dash", () => {
    const line = stripAnsi(renderMarkdownLine("- first item"));
    expect(line).toContain("•");
    expect(line).toContain("first item");
    expect(line).not.toContain("- first item");
  });

  it("renders an ordered list preserving its number", () => {
    expect(stripAnsi(renderMarkdownLine("1. step one"))).toContain("1.");
  });

  it("keeps fenced code inside the block and closes it", () => {
    const open = stripAnsi(renderMarkdownLine("```ts"));
    const inner = stripAnsi(renderMarkdownLine("const a = 1;"));
    const close = stripAnsi(renderMarkdownLine("```"));

    expect(open).toContain("┌──");
    expect(inner).toContain("const a = 1;");
    expect(close).toContain("└───");
  });

  it("renders headings at all three levels", () => {
    expect(stripAnsi(renderMarkdownLine("# H1"))).toContain("H1");
    expect(stripAnsi(renderMarkdownLine("## H2"))).toContain("H2");
    expect(stripAnsi(renderMarkdownLine("### H3"))).toContain("H3");
  });

  it("renders a blockquote with the quote bar", () => {
    expect(stripAnsi(renderMarkdownLine("> quoted"))).toContain("quoted");
  });
});

describe("renderInlineMarkdown", () => {
  it("returns an empty string for empty input", () => {
    expect(renderInlineMarkdown("")).toBe("");
  });

  it("leaves text without markup untouched", () => {
    expect(stripAnsi(renderInlineMarkdown("plain"))).toBe("plain");
  });
});
