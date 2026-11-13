import { afterAll, describe, expect, it } from "vitest";

import {
  createParser,
  disposeTreeSitter,
  getSpecByExt,
  loadLanguage,
  MAX_PARSE_BYTES,
  parseSource,
} from "./index";

describe("parseSource", () => {
  afterAll(async () => {
    await disposeTreeSitter();
  });

  it("returns null for sources above the size cap without throwing", async () => {
    const parser = await createParser();
    try {
      const oversized = "a".repeat(MAX_PARSE_BYTES + 1);
      expect(parseSource(parser, oversized)).toBeNull();
    } finally {
      parser.delete();
    }
  });

  it("parses a normal source", async () => {
    const spec = getSpecByExt(".ts");
    if (spec == null) {
      throw new Error("missing grammar spec for .ts");
    }

    const parser = await createParser();
    try {
      parser.setLanguage(await loadLanguage(".ts", spec));
      const tree = parseSource(parser, "const x: number = 1;");
      if (tree == null) {
        throw new Error("parseSource returned no tree for a normal source");
      }

      try {
        expect(tree.rootNode.hasError).toBe(false);
      } finally {
        tree.delete();
      }
    } finally {
      parser.delete();
    }
  });
});
