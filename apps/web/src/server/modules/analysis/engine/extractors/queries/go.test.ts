import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { goQuerySpec } from "./go";

const FIXTURE = [
  "package main",
  "",
  "import (",
  '  "fmt"',
  "",
  '  "github.com/gin-gonic/gin"',
  ")",
  "",
  "func main() {",
  "  r := gin.Default()",
  '  r.GET("/users", handler)',
  '  fmt.Println("started")',
  "}",
  "",
  "type User struct {",
  "  Name string",
  "}",
  "",
  "type Repo interface {",
  "  Find(id string) *User",
  "}",
  "",
  "func handler(c *gin.Context) {}",
].join("\n");

function goSpec() {
  const spec = getSpecByExt(".go");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("goQuerySpec", () => {
  it("captures Go declarations and imports", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".go", goSpec());
      parser.setLanguage(language);
      const tree = parser.parse(FIXTURE);
      try {
        const symbolQuery = language.query(goQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["main", "User", "Repo", "handler"]);
        } finally {
          symbolQuery.delete();
        }

        const importQuery = language.query(goQuerySpec.imports);
        try {
          // The collector strips the literal's quotes before storing the module path.
          const sources = importQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "import.source")
            .map((capture) => capture.node.text.replaceAll(/^"|"$/gu, ""));

          expect(sources).toEqual(["fmt", "github.com/gin-gonic/gin"]);
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
