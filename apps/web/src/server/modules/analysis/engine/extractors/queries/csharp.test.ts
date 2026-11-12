import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { csharpQuerySpec } from "./csharp";

const FIXTURE = [
  "using System;",
  "",
  "public class User",
  "{",
  "    public static void Main(string[] args)",
  "    {",
  "        Handler();",
  "    }",
  "",
  "    public void Handler() { }",
  "}",
].join("\n");

const ROUTE_FIXTURE = [
  "public class Routes",
  "{",
  '    [HttpGet("/users")]',
  "    public void Route() { }",
  "}",
].join("\n");

const SOURCE_SECTIONS = [
  "symbols",
  "imports",
  "routes",
  "entrypoints",
  "complexity",
  "calls",
] as const;

function csharpSpec() {
  const spec = getSpecByExt(".cs");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("csharpQuerySpec", () => {
  it("captures C# declarations and imports", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".cs", csharpSpec());
      parser.setLanguage(language);
      const tree = parser.parse(FIXTURE);
      try {
        const symbolQuery = language.query(csharpQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["User", "Main", "Handler"]);
        } finally {
          symbolQuery.delete();
        }

        const importQuery = language.query(csharpQuerySpec.imports);
        try {
          const sources = importQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "import.source")
            .map((capture) => capture.node.text);

          expect(sources).toEqual(["System"]);
        } finally {
          importQuery.delete();
        }
      } finally {
        tree.delete();
      }
    } finally {
      parser.delete();
    }
  });

  it("captures C# routes", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".cs", csharpSpec());
      parser.setLanguage(language);
      const tree = parser.parse(ROUTE_FIXTURE);
      try {
        const routeQuery = language.query(csharpQuerySpec.routes);
        try {
          const paths = routeQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "route.path")
            .map((capture) => capture.node.text.replaceAll(/^"|"$/gu, ""));

          expect(paths).toEqual(["/users"]);
        } finally {
          routeQuery.delete();
        }
      } finally {
        tree.delete();
      }
    } finally {
      parser.delete();
    }
  });

  it("compiles every non-empty query section", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".cs", csharpSpec());
      for (const section of SOURCE_SECTIONS) {
        const source = csharpQuerySpec[section] ?? "";
        expect(source.trim().length).toBeGreaterThan(0);
        try {
          expect(() => language.query(source).delete()).not.toThrow();
        } catch (error) {
          throw new Error(`query section "${section}" failed`, { cause: error });
        }
      }
    } finally {
      parser.delete();
    }
  });
});
