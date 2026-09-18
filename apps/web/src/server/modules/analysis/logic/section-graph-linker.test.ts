import { describe, expect, it } from "vitest";

import { DocumentFormatter } from "./section-graph-linker";

describe("DocumentFormatter.withGraphLinks", () => {
  it("splits a document into sections by headings", () => {
    const document = [
      "# Overview",
      "Intro text.",
      "",
      "## API",
      "The file src/routes.ts exposes REST endpoints.",
    ].join("\n");

    const result = DocumentFormatter.withGraphLinks(document, null, "README", "1.0.0");

    expect(result.type).toBe("README");
    expect(result.version).toBe("1.0.0");
    expect(result.sections).toEqual([
      expect.objectContaining({
        content: "Intro text.",
        endLine: 2,
        startLine: 0,
        title: "Overview",
      }),
      expect.objectContaining({
        content: "The file src/routes.ts exposes REST endpoints.",
        endLine: 4,
        startLine: 3,
        title: "API",
      }),
    ]);
  });

  it("text before the first heading lands in the Preamble section", () => {
    const result = DocumentFormatter.withGraphLinks(
      "Lead text.\n\n# Title\nBody",
      null,
      "README",
      "1",
    );

    expect(result.sections).toEqual([
      expect.objectContaining({
        content: "Lead text.",
        endLine: 1,
        startLine: 0,
        title: "Preamble",
      }),
      expect.objectContaining({ content: "Body", endLine: 3, startLine: 2, title: "Title" }),
    ]);
  });

  it("without headings, a single Document section is created", () => {
    const result = DocumentFormatter.withGraphLinks("just text", null, "README", "v1");

    expect(result.sections).toEqual([
      expect.objectContaining({
        content: "just text",
        endLine: 0,
        startLine: 0,
        title: "Document",
      }),
    ]);
  });

  it("an empty document yields an empty section list", () => {
    expect(DocumentFormatter.withGraphLinks("", null, "README", "1").sections).toEqual([]);
  });

  it("section id normalizes doc type and heading", () => {
    const result = DocumentFormatter.withGraphLinks("## My Great Section\n", null, "README", "1");

    expect(result.sections[0]?.id).toBe("section-readme-my-great-section");
  });

  it("links graphNodeIds by component and file mentions", () => {
    const graph = {
      nodes: [
        { id: "node-1", label: "UserService" },
        { id: "node-2", name: "src/app.ts" },
        { id: "node-3", label: "Unrelated" },
      ],
    };
    const document = [
      "# Features",
      "The component named UserService handles auth.",
      "The file src/app.ts is the entry.",
    ].join("\n");

    const result = DocumentFormatter.withGraphLinks(document, graph, "README", "1");

    expect(result.sections[0]?.graphNodeIds).toEqual(["node-1", "node-2"]);
  });

  it("links graphNodeIds by section heading similarity", () => {
    const graph = { nodes: [{ id: "api-node", label: "API Routes" }] };

    const result = DocumentFormatter.withGraphLinks(
      "# API Routes\nSome text",
      graph,
      "README",
      "1",
    );

    expect(result.sections[0]?.graphNodeIds).toEqual(["api-node"]);
  });

  it("graphNodeIds are empty when no graph is provided", () => {
    const result = DocumentFormatter.withGraphLinks("# Section\nBody", undefined, "README", "1");

    expect(result.sections[0]?.graphNodeIds).toEqual([]);
  });
});
