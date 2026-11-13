import type Parser from "web-tree-sitter";

import { getParserForExt, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";
import { getFileExtension } from "@/server/utils/path-operations";

import type { RepositoryFile } from "../engine/core/discovery.types";

export type ChangedNode = {
  line: number;
  name?: string;
  nodeType: string;
  path: string;
};

const DECLARATION_TYPES = new Set([
  "arrow_function",
  "class_declaration",
  "class_specifier",
  "function_declaration",
  "function_definition",
  "function_item",
  "method_declaration",
  "method_definition",
]);

export async function mapAddedLinesToNodes(
  file: RepositoryFile,
  addedLines: number[],
): Promise<ChangedNode[]> {
  const ext = getFileExtension(file.path);
  const spec = getSpecByExt(ext);
  if (spec == null) {
    return [];
  }

  const parser = await getParserForExt(ext);
  const language = await loadLanguage(ext, spec);
  parser.setLanguage(language);

  let tree: Parser.Tree | undefined;

  try {
    tree = parser.parse(file.content);
    const seen = new Set<string>();
    const nodes: ChangedNode[] = [];

    for (const line of addedLines) {
      let node: Parser.SyntaxNode | null = tree.rootNode.descendantForPosition({
        column: 0,
        row: Math.max(0, line - 1),
      });

      while (node != null && !DECLARATION_TYPES.has(node.type)) {
        node = node.parent;
      }

      if (node == null) {
        continue;
      }

      const key = `${line}:${node.type}:${node.startPosition.row}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      nodes.push({
        line,
        name: node.childForFieldName("name")?.text,
        nodeType: node.type,
        path: file.path,
      });
    }

    return nodes;
  } finally {
    tree?.delete();
  }
}
