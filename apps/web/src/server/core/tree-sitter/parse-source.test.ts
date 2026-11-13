import { afterAll, describe, expect, it } from "vitest";

import {
  createParser,
  disposeTreeSitter,
  getSpecByExt,
  loadLanguage,
  MAX_PARSE_BYTES,
  parseSource,
} from "./index";

async function parserWithTypescript() {
  const spec = getSpecByExt(".ts");
  if (spec == null) {
    throw new Error("missing grammar spec for .ts");
  }

  const parser = await createParser();
  parser.setLanguage(await loadLanguage(".ts", spec));
  return parser;
}

describe("parseSource", () => {
  afterAll(async () => {
    await disposeTreeSitter();
  });

  it("keeps the production cap at 5 MB", () => {
    expect(MAX_PARSE_BYTES).toBe(5_000_000);
  });

  it("returns a tree just below the limit and null just above it", async () => {
    const parser = await parserWithTypescript();
    try {
      const source = "const x: number = 1;";
      const limit = Buffer.byteLength(source, "utf8") + 1;

      const tree = parseSource(parser, source, limit);
      if (tree == null) {
        throw new Error("parseSource dropped a source below the limit");
      }

      try {
        expect(tree.rootNode.hasError).toBe(false);
      } finally {
        tree.delete();
      }

      expect(parseSource(parser, `${source}${" ".repeat(limit)}`, limit)).toBeNull();
    } finally {
      parser.delete();
    }
  });

  it("counts UTF-8 bytes rather than UTF-16 code units", async () => {
    const parser = await parserWithTypescript();
    try {
      const limit = 8;
      const source = "é".repeat(limit);

      expect(Buffer.byteLength(source, "utf8")).toBeGreaterThan(limit);
      expect(parseSource(parser, source, limit)).toBeNull();
    } finally {
      parser.delete();
    }
  });
});
