import { describe, expect, it } from "vitest";
import { Query } from "web-tree-sitter";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { rustQuerySpec } from "./rust";
import { parseFixture } from "./test-utils";

const FIXTURE = [
  "use std::fmt;",
  "",
  "struct User {",
  "    name: String,",
  "}",
  "",
  "trait Repo {",
  "    fn find(&self) -> Option<User> {",
  "        None",
  "    }",
  "}",
  "",
  "fn handler(value: User) -> String {",
  '    format!("{value:?}")',
  "}",
  "",
  "fn main() {",
  '    handler(User { name: String::from("x") });',
  "}",
].join("\n");

const ROUTE_FIXTURE = ['#[get("/users")]', "fn route() {}"].join("\n");

const SOURCE_SECTIONS = [
  "symbols",
  "imports",
  "routes",
  "entrypoints",
  "complexity",
  "calls",
] as const;

function rustSpec() {
  const spec = getSpecByExt(".rs");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("rustQuerySpec", () => {
  it("captures Rust declarations and imports", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".rs", rustSpec());
      parser.setLanguage(language);
      const tree = parseFixture(parser, FIXTURE);
      try {
        const symbolQuery = new Query(language, rustQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["User", "Repo", "find", "handler", "main"]);
        } finally {
          symbolQuery.delete();
        }

        const importQuery = new Query(language, rustQuerySpec.imports);
        try {
          const sources = importQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "import.source")
            .map((capture) => capture.node.text);

          expect(sources).toEqual(["std::fmt"]);
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

  it("captures Rust routes", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".rs", rustSpec());
      parser.setLanguage(language);
      const tree = parseFixture(parser, ROUTE_FIXTURE);
      try {
        const routeQuery = new Query(language, rustQuerySpec.routes);
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
      const language = await loadLanguage(".rs", rustSpec());
      for (const section of SOURCE_SECTIONS) {
        const source = rustQuerySpec[section] ?? "";
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
