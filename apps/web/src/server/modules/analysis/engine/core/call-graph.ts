import type Parser from "web-tree-sitter";

import { appLogger } from "@/server/core/app-logger";
import { getParserForExt, getSpecByExt, loadLanguage } from "@/server/core/tree-sitter";
import { compileQuery } from "@/server/core/tree-sitter/query-cache";

import { capturesByName, firstCapture } from "../extractors/queries/captures";
import type { LanguageQuerySpec } from "../extractors/queries/types";
import type { CallSite, ImportRef, RepositoryFile, ResolvedCallEdge } from "./discovery.types";
import { resolveExportedSymbol, type SymbolIndex } from "./symbol-index";

export type { CallSite, ResolvedCallEdge };

const FUNCTION_NODE_TYPES = new Set([
  "arrow_function",
  "function_declaration",
  "function_definition",
  "function_definition_statement",
  "function_expression",
  "function_item",
  "local_function_definition_statement",
  "method_declaration",
  "method_definition",
]);

// Stops at the next function boundary so an anonymous callback is never attributed outward.
function findDeclaratorName(fn: Parser.SyntaxNode): string | null {
  let current = fn.parent;

  while (current != null && !FUNCTION_NODE_TYPES.has(current.type)) {
    if (current.type === "variable_declarator") {
      return current.childForFieldName("name")?.text ?? null;
    }
    current = current.parent;
  }

  return null;
}

function findEnclosingFunction(node: Parser.SyntaxNode): string | null {
  let current: Parser.SyntaxNode | null = node.parent;

  while (current != null) {
    if (FUNCTION_NODE_TYPES.has(current.type)) {
      const name = current.childForFieldName("name")?.text;
      if (name != null) {
        return name;
      }
      return findDeclaratorName(current);
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
  } catch (error) {
    appLogger.debug({
      error,
      ext,
      msg: "Tree-sitter call-site extraction failed",
      path: file.path,
    });
    return [];
  } finally {
    tree?.delete();
  }
}

export function resolveCallSites(
  sites: CallSite[],
  importDetailsByPath: Map<string, ImportRef[]>,
  index: SymbolIndex,
  resolveImport: (fromPath: string, specifier: string) => string | null,
): ResolvedCallEdge[] {
  return sites.map((site) => {
    if (site.receiver != null) {
      return { ...site, resolved: false };
    }

    const imports = importDetailsByPath.get(site.path) ?? [];

    for (const detail of imports) {
      if (detail.kind === "side-effect" || detail.kind === "require") {
        continue;
      }

      const names = detail.names ?? [];
      const matchesImport = names.includes(site.calleeName);

      if (!matchesImport) {
        continue;
      }

      const targetPath = resolveImport(site.path, detail.source);
      if (targetPath == null) {
        continue;
      }

      const symbol = resolveExportedSymbol(index, targetPath, site.calleeName);
      if (symbol != null) {
        return { ...site, resolved: true, targetPath };
      }
    }

    return { ...site, resolved: false };
  });
}
