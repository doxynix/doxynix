import type { Parser, Tree } from "web-tree-sitter";

import { parseSource } from "@/server/core/tree-sitter";

export function parseFixture(parser: Parser, source: string): Tree {
  const tree = parseSource(parser, source);
  if (tree == null) {
    throw new Error("Tree-sitter returned no tree");
  }
  return tree;
}
