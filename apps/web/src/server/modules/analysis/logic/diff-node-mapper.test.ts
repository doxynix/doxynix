import { describe, expect, it } from "vitest";

import { mapAddedLinesToNodes } from "./diff-node-mapper";

describe("mapAddedLinesToNodes", () => {
  it("walks from a changed line up to the enclosing declaration", async () => {
    const nodes = await mapAddedLinesToNodes(
      {
        content: ["function a() {", "  return 1;", "}", "function b() {", "  return 2;", "}"].join(
          "\n",
        ),
        path: "src/a.ts",
      },
      [2, 5],
    );

    expect(nodes).toEqual([
      expect.objectContaining({ line: 2, name: "a", nodeType: "function_declaration" }),
      expect.objectContaining({ line: 5, name: "b", nodeType: "function_declaration" }),
    ]);
  });

  it("names an arrow function after its variable declarator", async () => {
    const nodes = await mapAddedLinesToNodes(
      {
        content: ["const handler = () => {", "  return 1;", "};"].join("\n"),
        path: "src/handler.ts",
      },
      [2],
    );

    expect(nodes).toEqual([
      expect.objectContaining({ line: 2, name: "handler", nodeType: "arrow_function" }),
    ]);
  });
});
