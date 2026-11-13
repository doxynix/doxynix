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

  it("attributes a call in a function expression to its declarator", async () => {
    const sites = await extractCallSites(
      { content: "function a() { const f = function () { g(); }; }", path: "src/expr.ts" },
      ".ts",
      typescriptQuerySpec,
    );

    expect(sites).toEqual([expect.objectContaining({ calleeName: "g", callerName: "f" })]);
  });

  it("emits a this-receiver call site and keeps it unresolved", async () => {
    const sites = await extractCallSites(
      { content: "class C { run() { this.helper(); } }", path: "src/this.ts" },
      ".ts",
      typescriptQuerySpec,
    );

    expect(sites).toEqual([
      expect.objectContaining({ calleeName: "helper", callerName: "run", receiver: "this" }),
    ]);

    const edges = resolveCallSites(
      sites,
      new Map([["src/this.ts", [{ kind: "named", names: ["helper"], source: "./b" }]]]),
      buildSymbolIndex([
        moduleRef("src/b.ts", [
          { confidence: 78, exported: true, kind: "function", name: "helper", path: "src/b.ts" },
        ]),
      ]),
      () => "src/b.ts",
    );

    expect(edges).toEqual([expect.objectContaining({ calleeName: "helper", resolved: false })]);
  });

  it("returns no call sites when the calls query cannot compile", async () => {
    const sites = await extractCallSites(
      { content: "function a() {}", path: "src/broken.ts" },
      ".ts",
      { ...typescriptQuerySpec, calls: "(not_a_node) @call.name" },
    );

    expect(sites).toEqual([]);
  });
});

describe("resolveCallSites", () => {
  const exportedFoo = () =>
    buildSymbolIndex([
      moduleRef("src/b.ts", [
        { confidence: 78, exported: true, kind: "function", name: "foo", path: "src/b.ts" },
      ]),
    ]);

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

  it("resolves a call through a default import", () => {
    const edges = resolveCallSites(
      [{ calleeName: "foo", callerName: "main", line: 3, path: "src/a.ts" }],
      new Map([["src/a.ts", [{ kind: "default", names: ["foo"], source: "./b" }]]]),
      exportedFoo(),
      () => "src/b.ts",
    );

    expect(edges).toEqual([
      expect.objectContaining({ calleeName: "foo", resolved: true, targetPath: "src/b.ts" }),
    ]);
  });

  it("leaves a namespace receiver call unresolved", () => {
    const edges = resolveCallSites(
      [
        {
          calleeName: "foo",
          callerName: "main",
          line: 3,
          path: "src/a.ts",
          receiver: "ns",
        },
      ],
      new Map([["src/a.ts", [{ kind: "namespace", names: ["ns"], source: "./b" }]]]),
      exportedFoo(),
      () => "src/b.ts",
    );

    expect(edges).toEqual([expect.objectContaining({ calleeName: "foo", resolved: false })]);
  });

  it("does not resolve a callee that is only exported by the default import's file", () => {
    const index = buildSymbolIndex([
      moduleRef("src/b.ts", [
        { confidence: 78, exported: true, kind: "function", name: "foo", path: "src/b.ts" },
        { confidence: 78, exported: true, kind: "function", name: "bar", path: "src/b.ts" },
      ]),
    ]);

    const edges = resolveCallSites(
      [{ calleeName: "bar", callerName: "main", line: 3, path: "src/a.ts" }],
      new Map([["src/a.ts", [{ kind: "default", names: ["foo"], source: "./b" }]]]),
      index,
      () => "src/b.ts",
    );

    expect(edges).toEqual([expect.objectContaining({ calleeName: "bar", resolved: false })]);
  });
});
