import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { javaQuerySpec } from "./java";

const FIXTURE = [
  "import java.util.List;",
  "",
  "public class User {",
  "    public static void main(String[] args) {",
  "        handler();",
  "    }",
  "",
  "    public String handler() {",
  '        return "";',
  "    }",
  "}",
].join("\n");

const ROUTE_FIXTURE = [
  "public class Routes {",
  '    @GetMapping("/users")',
  "    public void route() {}",
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

function javaSpec() {
  const spec = getSpecByExt(".java");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("javaQuerySpec", () => {
  it("captures Java declarations and imports", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".java", javaSpec());
      parser.setLanguage(language);
      const tree = parser.parse(FIXTURE);
      try {
        const symbolQuery = language.query(javaQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["User", "main", "handler"]);
        } finally {
          symbolQuery.delete();
        }

        const importQuery = language.query(javaQuerySpec.imports);
        try {
          const sources = importQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "import.source")
            .map((capture) => capture.node.text);

          expect(sources).toEqual(["java.util.List"]);
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

  it("captures Java routes", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".java", javaSpec());
      parser.setLanguage(language);
      const tree = parser.parse(ROUTE_FIXTURE);
      try {
        const routeQuery = language.query(javaQuerySpec.routes);
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
      const language = await loadLanguage(".java", javaSpec());
      for (const section of SOURCE_SECTIONS) {
        const source = javaQuerySpec[section] ?? "";
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
