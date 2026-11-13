import { describe, expect, it } from "vitest";

import type { ModuleRef } from "./discovery.types";
import { buildSymbolIndex, resolveExportedSymbol } from "./symbol-index";

const moduleRef = (path: string, symbols: ModuleRef["symbols"]): ModuleRef => ({
  apiSurface: 0,
  categories: [],
  entrypointHints: [],
  exports: symbols.filter((symbol) => symbol.exported).length,
  frameworkHints: [],
  imports: [],
  parseTier: "tree-sitter",
  path,
  routeCount: 0,
  symbols,
});

describe("buildSymbolIndex", () => {
  it("indexes all symbols and exported symbols separately", () => {
    const index = buildSymbolIndex([
      moduleRef("src/b.ts", [
        { confidence: 78, exported: true, kind: "function", name: "foo", path: "src/b.ts" },
        { confidence: 78, exported: false, kind: "function", name: "bar", path: "src/b.ts" },
      ]),
    ]);

    expect(index.byPath.get("src/b.ts")?.get("foo")?.name).toBe("foo");
    expect(index.exportedByPath.get("src/b.ts")?.has("bar")).toBe(false);
    expect(resolveExportedSymbol(index, "src/b.ts", "foo")?.name).toBe("foo");
    expect(resolveExportedSymbol(index, "src/b.ts", "bar")).toBeNull();
  });
});
