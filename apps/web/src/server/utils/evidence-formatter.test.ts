import { describe, expect, it } from "vitest";

import { EvidenceFormatter } from "./evidence-formatter";

describe("EvidenceFormatter", () => {
  it("formats JSON with truncation when size exceeded", () => {
    const ef = new EvidenceFormatter();
    const big = { items: Array.from({ length: 10_000 }, (_, i) => `item-${i}`) };
    const res = ef.formatJson(big, { maxSize: 200 });
    expect(res.content.length).toBeLessThanOrEqual(200 + 50); // some allowance for truncation marker
    expect(res.truncated).toBe(true);
    expect(res.metadata.format).toBe("json");
  });

  it("formats paths as text, json and xml", () => {
    const ef = new EvidenceFormatter();
    const paths = ["src/a.ts", "src/b.ts"];
    const text = ef.formatPaths(paths, "text");
    expect(text.content).toContain("src/a.ts");

    const json = ef.formatPaths(paths, "json");
    expect(json.metadata.format).toBe("json");

    const xml = ef.formatPaths(paths, "xml");
    expect(xml.content).toContain("<paths");
  });

  it("formatComposite combines blocks and applies truncation", () => {
    const ef = new EvidenceFormatter();
    const blocks = [
      { data: { a: 1 }, type: "custom" as const },
      { data: { b: 2 }, type: "custom" as const },
    ];

    const res = ef.formatComposite(blocks, { maxSize: 10, truncationSuffix: "..." });
    expect(res.truncated).toBe(true);
    expect(res.content.length).toBeLessThanOrEqual(13);
  });

  it("formatXml includes attributes when provided and escapes values", () => {
    const ef = new EvidenceFormatter();
    const data = { x: "<danger> & ok" };
    const res = ef.formatXml("custom", data, { attributes: { id: "a&b" } });
    expect(res.content).toContain('id="a&amp;b"');
    expect(res.content).toContain("&lt;danger&gt;");
  });

  it("formats paths as text with correct text metadata", () => {
    const ef = new EvidenceFormatter();
    const text = ef.formatPaths(["src/a.ts"], "text");
    expect(text.content).toContain("src/a.ts");
    expect(text.metadata.format).toBe("text");
  });
});
