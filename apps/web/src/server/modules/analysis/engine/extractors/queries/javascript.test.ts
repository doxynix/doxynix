import { describe, expect, it } from "vitest";

import { createParser, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";

import { javascriptQuerySpec } from "./javascript";

const FIXTURE = [
  'import express from "express";',
  "export function a() {}",
  "function b() {}",
  "class C { run() {} }",
  "const d = () => 1;",
  'const app = express(); app.get("/x", handler);',
].join("\n");

function jsSpec() {
  const spec = getSpecByExt(".js");
  expect(spec).toBeDefined();
  if (spec == null) {
    throw new Error("missing grammar spec");
  }
  return spec;
}

describe("javascriptQuerySpec", () => {
  it("captures JavaScript declarations and routes", async () => {
    const parser = await createParser();
    try {
      const language = await loadLanguage(".js", jsSpec());
      parser.setLanguage(language);
      const tree = parser.parse(FIXTURE);
      try {
        const query = language.query(javascriptQuerySpec.symbols);
        try {
          const names = query
            .captures(tree.rootNode)
            .filter((capture) => /^symbol\.[a-z]+\.name$/u.test(capture.name))
            .map((capture) => capture.node.text);

          expect(names).toEqual(["a", "b", "C", "run", "d"]);
        } finally {
          query.delete();
        }
      } finally {
        tree.delete();
      }
    } finally {
      parser.delete();
    }
  });
});
