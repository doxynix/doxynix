import { describe, expect, it } from "vitest";
import type Parser from "web-tree-sitter";

import { capturesByName, firstCapture } from "./captures";
import type { LanguageQuerySpec } from "./types";

const node = (text: string) => ({ text }) as Parser.SyntaxNode;

describe("capturesByName", () => {
  it("groups captures by name and preserves order", () => {
    const map = capturesByName([
      { name: "import.named", node: node("a") },
      { name: "import.source", node: node("./x") },
      { name: "import.named", node: node("b") },
    ]);

    expect(map.get("import.named")?.map((item) => item.text)).toEqual(["a", "b"]);
    expect(firstCapture(map, "import.source")?.text).toBe("./x");
    expect(firstCapture(map, "missing")).toBeUndefined();
  });
});

describe("LanguageQuerySpec", () => {
  it("is satisfied by the required query sources alone", () => {
    const spec: LanguageQuerySpec = {
      entrypoints: "(program) @entry",
      exports: "(export_statement) @export",
      imports: "(import_statement) @import",
      nestingNodeTypes: [],
      routes: "(call_expression) @route",
      symbols: "(function_declaration) @symbol",
    };

    expect(spec.nestingNodeTypes).toEqual([]);
  });
});
