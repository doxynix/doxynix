import { describe, expect, it } from "vitest";
import { Query } from "web-tree-sitter";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { phpQuerySpec } from "./php";
import { parseFixture } from "./test-utils";

const FIXTURE = [
  "<?php",
  "namespace App;",
  "",
  "use Foo\\Bar;",
  "",
  'require "x.php";',
  "",
  "class User {",
  "    public function run(): void {",
  '        Bar::dispatch("/users");',
  "    }",
  "}",
].join("\n");

const ROUTE_FIXTURE = ["<?php", 'Route::get("/users");'].join("\n");

const SOURCE_SECTIONS = ["symbols", "imports", "routes", "complexity", "calls"] as const;

function phpSpec() {
  const spec = getSpecByExt(".php");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("phpQuerySpec", () => {
  it("captures PHP declarations and imports", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".php", phpSpec());
      parser.setLanguage(language);
      const tree = parseFixture(parser, FIXTURE);
      try {
        const symbolQuery = new Query(language, phpQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["User", "run"]);
        } finally {
          symbolQuery.delete();
        }

        const importQuery = new Query(language, phpQuerySpec.imports);
        try {
          const sources = importQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "import.source")
            .map((capture) => capture.node.text);

          expect(sources).toEqual(["Foo\\Bar", "x.php"]);
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

  it("captures PHP routes", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".php", phpSpec());
      parser.setLanguage(language);
      const tree = parseFixture(parser, ROUTE_FIXTURE);
      try {
        const routeQuery = new Query(language, phpQuerySpec.routes);
        try {
          const paths = routeQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "route.path")
            .map((capture) => capture.node.text);

          expect(paths).toEqual(["/users"]);
          expect(phpQuerySpec.normalizeRouteMethod?.("get")).toBe("GET");
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
      const language = await loadLanguage(".php", phpSpec());
      for (const section of SOURCE_SECTIONS) {
        const source = phpQuerySpec[section] ?? "";
        expect(source.trim().length).toBeGreaterThan(0);
        try {
          expect(() => new Query(language, source).delete()).not.toThrow();
        } catch (error) {
          throw new Error(`query section "${section}" failed`, { cause: error });
        }
      }
    } finally {
      parser.delete();
    }
  });
});
