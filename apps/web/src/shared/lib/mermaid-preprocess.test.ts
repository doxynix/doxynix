import { describe, expect, it } from "vitest";

import { preprocessMermaidChart } from "./mermaid-preprocess";

describe("preprocessMermaidChart", () => {
  it("replaces [[path]] links and adds click lines for flowcharts", () => {
    const chart = ["graph TD", "  A[[src/app.ts]] --> B", "  B --> C[[src/lib/api.ts]]"].join("\n");

    const result = preprocessMermaidChart(chart);

    expect(result).toContain("  Asrc/app.ts --> B");
    expect(result).toContain('  click A "/code?node=file:src%2Fapp.ts" "Explore src/app.ts"');
    expect(result).toContain("  B --> Csrc/lib/api.ts");
    expect(result).toContain(
      '  click B "/code?node=file:src%2Flib%2Fapi.ts" "Explore src/lib/api.ts"',
    );
  });

  it("supports a custom href builder", () => {
    const result = preprocessMermaidChart("graph TD\n  A[[src/a.ts]]\n", (path) => `/r/${path}`);

    expect(result).toContain('  click A "/r/src/a.ts" "Explore src/a.ts"');
  });

  it("cleans links in non-flowchart diagrams without click lines", () => {
    const result = preprocessMermaidChart("sequenceDiagram\n  Alice->>Bob: [[docs/x.md]]\n");

    expect(result).toContain("  Alice->>Bob: docs/x.md");
    expect(result).not.toContain("click");
  });

  it("extracts the node id from leading whitespace", () => {
    const result = preprocessMermaidChart("graph LR\n    nodeA[[a.ts]]\n");

    expect(result).toContain('  click nodeA "/code?node=file:a.ts" "Explore a.ts"');
  });

  it("passes through lines without links", () => {
    const chart = "graph TD\n  A --> B";

    expect(preprocessMermaidChart(chart)).toBe(chart);
  });

  it("returns an empty string for an empty chart", () => {
    expect(preprocessMermaidChart("")).toBe("");
  });
});
