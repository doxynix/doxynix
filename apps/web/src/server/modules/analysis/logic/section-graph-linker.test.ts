import { describe, expect, it } from "vitest";

import { DocumentFormatter } from "./section-graph-linker";

describe("DocumentFormatter.withGraphLinks", () => {
  it("разбивает документ на секции по заголовкам", () => {
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

  it("текст до первого заголовка попадает в секцию Preamble", () => {
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

  it("без заголовков создаётся единственная секция Document", () => {
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

  it("пустой документ даёт пустой список секций", () => {
    expect(DocumentFormatter.withGraphLinks("", null, "README", "1").sections).toEqual([]);
  });

  it("id секции нормализует доктип и заголовок", () => {
    const result = DocumentFormatter.withGraphLinks("## My Great Section\n", null, "README", "1");

    expect(result.sections[0]?.id).toBe("section-readme-my-great-section");
  });

  it("связывает graphNodeIds по упоминаниям component и file", () => {
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

  it("связывает graphNodeIds по схожести заголовка секции", () => {
    const graph = { nodes: [{ id: "api-node", label: "API Routes" }] };

    const result = DocumentFormatter.withGraphLinks(
      "# API Routes\nSome text",
      graph,
      "README",
      "1",
    );

    expect(result.sections[0]?.graphNodeIds).toEqual(["api-node"]);
  });

  it("без графа graphNodeIds пустые", () => {
    const result = DocumentFormatter.withGraphLinks("# Section\nBody", undefined, "README", "1");

    expect(result.sections[0]?.graphNodeIds).toEqual([]);
  });
});
