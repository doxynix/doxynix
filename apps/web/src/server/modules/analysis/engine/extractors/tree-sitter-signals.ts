import type Parser from "web-tree-sitter";

import { appLogger } from "@/server/core/app-logger";
import {
  createParser,
  getSpecByExt,
  type LanguageSpec,
  loadLanguage,
} from "@/server/core/tree-sitter";
import { getFileExtension } from "@/server/utils/path-operations";

import type { FileSignals, RepositoryFile, RouteRef, SymbolRef } from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";
import { CONFIDENCE_LEVELS } from "../core/scoring-constants";

function lineOf(content: string, fragment: string) {
  const index = content.indexOf(fragment);
  if (index < 0) {
    return 1;
  }
  return content.slice(0, index).split(/\r?\n/u).length;
}

function extractNodeName(nodeText: string) {
  const firstLine = nodeText.split(/\r?\n/u, 1)[0]?.trim() ?? "";
  return /([A-Z_a-z]\w*)/.exec(firstLine)?.[1];
}

function collectRoutes(file: RepositoryFile, spec: LanguageSpec) {
  const routes: RouteRef[] = [];

  for (const routePattern of spec.routePatterns ?? []) {
    for (const match of file.content.matchAll(routePattern.pattern)) {
      const method =
        typeof match[routePattern.methodIndex] === "string"
          ? match[routePattern.methodIndex]?.toUpperCase()
          : undefined;
      const routePath =
        typeof match[routePattern.pathIndex] === "string"
          ? match[routePattern.pathIndex]
          : undefined;
      if (method == null || routePath == null) {
        continue;
      }
      routes.push({
        confidence: routePattern.confidence ?? CONFIDENCE_LEVELS.astRoute,
        framework: routePattern.framework,
        kind: "http",
        line: lineOf(file.content, match[0]),
        method,
        path: routePath,
        sourcePath: file.path,
      });
    }
  }

  return routes;
}

const AST_COMPLEXITY_NODES = new Set([
  "case_clause",
  "catch_clause",
  "conditional_expression",
  "do_statement",
  "elif_clause",
  "else_if_clause",
  "except_clause",
  "for_in_clause",
  "for_statement",
  "if_statement",
  "switch_statement",
  "ternary_expression",
  "while_statement",
]);

const AST_NESTING_NODES = new Set([
  "catch_clause",
  "class_declaration",
  "class_definition",
  "do_statement",
  "except_clause",
  "for_statement",
  "function_declaration",
  "function_definition",
  "if_statement",
  "method_definition",
  "switch_statement",
  "while_statement",
]);

export async function collectTreeSitterSignals(file: RepositoryFile): Promise<FileSignals | null> {
  const ext = getFileExtension(file.path);
  const spec = getSpecByExt(ext);
  if (!spec) {
    return null;
  }

  try {
    const parser = await createParser();
    const lang = await loadLanguage(ext, spec);

    let tree: Parser.Tree | undefined;

    try {
      parser.setLanguage(lang);
      tree = parser.parse(file.content);
      const root = tree.rootNode;

      let apiSurface = 0;
      let exports = 0;
      const imports = new Set<string>();
      const symbols: SymbolRef[] = [];

      let complexity = 0;
      let maxNesting = 0;
      let currentNesting = 0;

      const declarationTypes = new Set(spec.declarations.flatMap((entry) => entry.types));
      const declarationKindByType = new Map(
        spec.declarations.flatMap((entry) =>
          entry.types.map((type) => [type, entry.kind] as const),
        ),
      );

      const cursor = root.walk();
      let reachedRoot = false;

      while (!reachedRoot) {
        const nodeType = cursor.nodeType;
        const nodeText = cursor.nodeText;

        if (AST_COMPLEXITY_NODES.has(nodeType)) {
          complexity += 1 + currentNesting;
          maxNesting = Math.max(maxNesting, currentNesting);
        }

        if (spec.imports.types.includes(nodeType)) {
          spec.imports.patterns.forEach((re) => {
            const match = nodeText.match(re);
            if (match?.[1]) {
              imports.add(match[1]);
            }
          });
        }

        if (declarationTypes.has(nodeType)) {
          exports += 1;
          const kind = declarationKindByType.get(nodeType) ?? "function";
          const name = extractNodeName(nodeText);
          if (name != null) {
            symbols.push({
              confidence: CONFIDENCE_LEVELS.astSymbol,
              exported: true,
              kind,
              line: lineOf(file.content, nodeText),
              name,
              path: file.path,
            });
          }
        }

        if (spec.api?.some((re) => re.test(nodeText))) {
          apiSurface++;
        }

        if (cursor.gotoFirstChild()) {
          if (AST_NESTING_NODES.has(nodeType)) {
            currentNesting++;
          }
          continue;
        }

        if (cursor.gotoNextSibling()) {
          continue;
        }

        let backtrack = true;
        while (backtrack) {
          if (!cursor.gotoParent()) {
            reachedRoot = true;
            backtrack = false;
          } else {
            const parentType = cursor.nodeType;
            if (AST_NESTING_NODES.has(parentType)) {
              currentNesting = Math.max(0, currentNesting - 1);
            }

            if (cursor.gotoNextSibling()) {
              backtrack = false;
            }
          }
        }
      }

      const routes = collectRoutes(file, spec);
      const frameworkHints = collectFrameworkFactsFromTokens(
        [...imports, file.path, ...symbols.map((symbol) => symbol.name)],
        file.path,
        78,
      );

      return {
        analysisMode: "tree-sitter",
        apiSurface: Math.max(apiSurface, routes.length),
        complexityMetrics: {
          complexity,
          maxNesting,
        },
        confidence: CONFIDENCE_LEVELS.astStructure,
        entrypointHint: spec.entrypoints.some((re) => re.test(file.content)),
        exports,
        frameworkHints,
        imports: Array.from(imports),
        path: file.path,
        routes,
        source: "extraction" as const,
        symbols,
      };
    } finally {
      // `tree` is undefined when `parser.parse` threw; `parser` always exists.
      tree?.delete();
      parser.delete();
    }
  } catch (error) {
    appLogger.error({
      error,
      ext,
      msg: "Tree-sitter unavailable; falling back to non-AST analysis",
      path: file.path,
    });
    return null;
  }
}
