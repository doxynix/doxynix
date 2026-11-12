import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { cQuerySpec } from "./c";
import { cppQuerySpec } from "./cpp";

const C_FIXTURE = [
  "#include <stdio.h>",
  "int main(void) { return 0; }",
  "struct User { int id; };",
].join("\n");

const CPP_FIXTURE = [
  "#include <iostream>",
  "namespace X { class User { public: int run(int a) { return a; } }; }",
  "int main() { return 0; }",
].join("\n");

const SOURCE_SECTIONS = ["symbols", "imports", "complexity", "calls"] as const;

function cSpec() {
  const spec = getSpecByExt(".c");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

function cppSpec() {
  const spec = getSpecByExt(".cpp");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("c-family query specs", () => {
  it("captures C functions, structs and includes", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".c", cSpec());
      parser.setLanguage(language);
      const tree = parser.parse(C_FIXTURE);
      try {
        const symbolQuery = language.query(cQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["main", "User"]);
        } finally {
          symbolQuery.delete();
        }

        const importQuery = language.query(cQuerySpec.imports);
        try {
          const sources = importQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "import.source")
            .map((capture) => capture.node.text);

          expect(sources).toEqual(["<stdio.h>"]);
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

  it("captures C++ namespaces, classes, methods and includes", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".cpp", cppSpec());
      parser.setLanguage(language);
      const tree = parser.parse(CPP_FIXTURE);
      try {
        const symbolQuery = language.query(cppQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["X", "User", "run", "main"]);
        } finally {
          symbolQuery.delete();
        }
      } finally {
        tree.delete();
      }
    } finally {
      parser.delete();
    }
  });

  it("compiles every non-empty C query section", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".c", cSpec());
      for (const section of SOURCE_SECTIONS) {
        const source = cQuerySpec[section] ?? "";
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

  it("compiles every non-empty C++ query section", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".cpp", cppSpec());
      for (const section of SOURCE_SECTIONS) {
        const source = cppQuerySpec[section] ?? "";
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
