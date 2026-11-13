import type Parser from "web-tree-sitter";

import { getParserForExt, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";
import { compileQuery } from "@/server/core/tree-sitter/query-cache";

import { capturesByName, firstCapture } from "../extractors/queries/captures";
import type { LanguageQuerySpec } from "../extractors/queries/types";
import type { CallSite, RepositoryFile } from "./discovery.types";

export type { CallSite };

const FUNCTION_NODE_TYPES = new Set([
  "arrow_function",
  "function_declaration",
  "function_definition",
  "function_definition_statement",
  "function_item",
  "local_function_definition_statement",
  "method_declaration",
  "method_definition",
]);

function findEnclosingFunction(node: Parser.SyntaxNode): string | null {
  let current: Parser.SyntaxNode | null = node.parent;

  while (current != null) {
    if (FUNCTION_NODE_TYPES.has(current.type)) {
      return current.childForFieldName("name")?.text ?? null;
    }
    current = current.parent;
  }

  return null;
}

export async function extractCallSites(
  file: RepositoryFile,
  ext: string,
  querySpec: LanguageQuerySpec,
): Promise<CallSite[]> {
  if (querySpec.calls == null || querySpec.calls.trim().length === 0) {
    return [];
  }

  const spec = getSpecByExt(ext);
  if (spec == null) {
    return [];
  }

  let tree: Parser.Tree | undefined;

  try {
    const parser = await getParserForExt(ext);
    const language = await loadLanguage(ext, spec);
    parser.setLanguage(language);
    tree = parser.parse(file.content);

    const query = await compileQuery(ext, spec, querySpec.calls);
    const sites: CallSite[] = [];

    for (const match of query.matches(tree.rootNode)) {
      const captures = capturesByName(match.captures);
      const expression = firstCapture(captures, "call.expression");
      const callee =
        firstCapture(captures, "call.name") ??
        firstCapture(captures, "call.method") ??
        firstCapture(captures, "call.constructor");
      if (expression == null || callee == null) {
        continue;
      }

      sites.push({
        calleeName: callee.text,
        callerName: findEnclosingFunction(expression),
        line: expression.startPosition.row + 1,
        path: file.path,
        receiver: firstCapture(captures, "call.object")?.text,
      });
    }

    return sites;
  } finally {
    tree?.delete();
  }
}
