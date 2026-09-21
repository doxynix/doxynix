import { describe, expect, it } from "vitest";

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

  it("renders GitHub alerts from > [!NOTE] blockquotes", async () => {
    const html = await markdownToHtml({
      content: "> [!NOTE]\n> Useful info for the user.",
    });

    expect(html).toContain("markdown-alert-note");
    expect(html).toContain("markdown-alert-title");
    expect(html).not.toContain("[!NOTE]");
  });

  it("highlights exotic and niche languages without crashing", async () => {
    const html = await markdownToHtml({
      content: "```fortran\nprogram hello\n  print *, 'hi'\nend program hello\n```",
    });

    expect(html).toContain("<pre");
  });

  it("falls back to plain text for unknown languages", async () => {
    const html = await markdownToHtml({
      content: "```klingon\ntlhIngan Hol\n```",
    });

    expect(html).toContain("<pre");
    expect(html).not.toMatch(/Cannot highlight|Unknown language/i);
  });

  it("strips style attributes from raw HTML but keeps className", async () => {
    const html = await markdownToHtml({
      content: '<div class="note" style="display:none">hello</div>',
    });

    expect(html).toContain('class="note"');
    expect(html).not.toContain("style=");
  });
});
