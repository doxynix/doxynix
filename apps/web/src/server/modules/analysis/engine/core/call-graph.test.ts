import { describe, expect, it } from "vitest";

import { typescriptQuerySpec } from "../extractors/queries/typescript";
import { extractCallSites, resolveCallSites } from "./call-graph";
import type { ModuleRef } from "./discovery.types";
import { buildSymbolIndex } from "./symbol-index";

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

describe("extractCallSites", () => {
  it("attributes calls to their enclosing function", async () => {
    const sites = await extractCallSites(
      {
        content: ["function a() { b(); obj.c(); }", "function b() {}"].join("\n"),
        path: "src/calls.ts",
      },
      ".ts",
      typescriptQuerySpec,
    );

    expect(sites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ calleeName: "b", callerName: "a", line: 1 }),
        expect.objectContaining({ calleeName: "c", callerName: "a", line: 1, receiver: "obj" }),
      ]),
    );
  });
});

describe("resolveCallSites", () => {
  it("resolves a call through a named import", () => {
    const index = buildSymbolIndex([
      moduleRef("src/b.ts", [
        { confidence: 78, exported: true, kind: "function", name: "foo", path: "src/b.ts" },
      ]),
    ]);

    const edges = resolveCallSites(
      [{ calleeName: "foo", callerName: "main", line: 3, path: "src/a.ts" }],
      new Map([
        [
          "src/a.ts",
          [
            {
              kind: "named",
              names: ["foo"],
              source: "./b",
            },
          ],
        ],
      ]),
      index,
      (_fromPath, specifier) => (specifier === "./b" ? "src/b.ts" : null),
    );

    expect(edges).toEqual([
      expect.objectContaining({ calleeName: "foo", resolved: true, targetPath: "src/b.ts" }),
    ]);
  });
});
