import { describe, expect, it } from "vitest";
import type { Node, QueryCapture } from "web-tree-sitter";

import { capturesByName, firstCapture } from "./captures";
import type { LanguageQuerySpec } from "./types";

const node = (text: string) => ({ text }) as Node;

const capture = (name: string, text: string): QueryCapture => ({
  name,
  node: node(text),
  patternIndex: 0,
});

describe("capturesByName", () => {
  it("groups captures by name and preserves order", () => {
    const map = capturesByName([
      capture("import.named", "a"),
      capture("import.source", "./x"),
      capture("import.named", "b"),
    ]);

    expect(map.get("import.named")?.map((item) => item.text)).toEqual(["a", "b"]);
    expect(firstCapture(map, "import.source")?.text).toBe("./x");
    expect(firstCapture(map, "missing")).toBeUndefined();
  });
});

describe("LanguageQuerySpec", () => {
  it("is satisfied by the required query sources alone", () => {
    const spec: LanguageQuerySpec = {
      complexityNodeTypes: [],
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
