import type { Parser, Tree } from "web-tree-sitter";

export function parseFixture(parser: Parser, source: string): Tree {
  const tree = parser.parse(source);
  if (tree == null) {
    throw new Error("Tree-sitter returned no tree");
  }
  return tree;
}
