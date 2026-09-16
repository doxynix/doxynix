import { describe, expect, it, vi } from "vitest";

vi.mock("@shikijs/rehype", () => ({
  default: () => () => {},
}));

vi.mock("@shikijs/transformers", () => ({
  transformerNotationDiff: () => ({}),
  transformerNotationFocus: () => ({}),
  transformerNotationHighlight: () => ({}),
}));

import { markdownToHtml } from "./markdown-to-html";

describe("markdown-to-html", () => {
  it("returns empty output for blank content", async () => {
    await expect(markdownToHtml({ content: "" })).resolves.toBe("");
  });

  it("sanitizes XSS payloads while rendering markdown structure", async () => {
    const html = await markdownToHtml({
      content: [
        "# Title",
        "",
        "- first item",
        "- second item",
        "",
        '<script>alert("boom")</script>',
        '<img src="x" onerror="alert(1)" />',
      ].join("\n"),
      name: "demo-repo",
      owner: "demo-owner",
    });

    expect(html).toContain("Title");
    expect(html).toContain("<li>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });
});
