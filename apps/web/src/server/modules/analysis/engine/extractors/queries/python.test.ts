import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { pythonQuerySpec } from "./python";

const FIXTURE = [
  "import os",
  "from fastapi import FastAPI",
  "",
  '@app.get("/x")',
  "def handler(a: int, b: str) -> str:",
  "    return a",
  "",
  "class User:",
  "    def run(self, x):",
  "        return x",
].join("\n");

function pySpec() {
  const spec = getSpecByExt(".py");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("pythonQuerySpec", () => {
  it("captures Python declarations, imports and routes", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".py", pySpec());
      parser.setLanguage(language);
      const tree = parser.parse(FIXTURE);
      try {
        const symbolQuery = language.query(pythonQuerySpec.symbols);
        try {
          const names = symbolQuery
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["handler", "User", "run"]);
        } finally {
          symbolQuery.delete();
        }

        const importQuery = language.query(pythonQuerySpec.imports);
        try {
          const sources = importQuery
            .captures(tree.rootNode)
            .filter((capture) => capture.name === "import.source")
            .map((capture) => capture.node.text);

          expect(sources).toEqual(["os", "fastapi"]);
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
