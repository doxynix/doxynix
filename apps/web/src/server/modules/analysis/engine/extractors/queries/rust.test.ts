import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { rustQuerySpec } from "./rust";

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
      const tree = parser.parse(FIXTURE);
      try {
        const symbolQuery = language.query(rustQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["User", "Repo", "find", "handler", "main"]);
        } finally {
          symbolQuery.delete();
        }

        const importQuery = language.query(rustQuerySpec.imports);
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
});
