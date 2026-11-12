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

function nodeName(node: Parser.SyntaxNode): string | undefined {
  // Arrow functions have no `name` field; the enclosing declarator carries it.
  return (
    node.childForFieldName("name")?.text ??
    node.parent?.childForFieldName("name")?.text ??
    extractNodeName(node.text)
  );
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

function detectRouteFramework(imports: Iterable<string>): string | undefined {
  const specifiers = [...imports];
  if (specifiers.some((specifier) => specifier === "hono" || specifier.startsWith("hono/"))) {
    return "Hono";
  }
  if (specifiers.includes("express")) {
    return "Express";
  }
  if (specifiers.some((specifier) => specifier === "fastify" || specifier.startsWith("fastify/"))) {
    return "Fastify";
  }
  return undefined;
}

function dedupeRoutes(routes: RouteRef[]): RouteRef[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = `${route.method ?? ""}:${route.path}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

function collectExportedNames(root: Parser.SyntaxNode): Set<string> {
  const names = new Set<string>();

  for (const statement of root.descendantsOfType("export_statement")) {
    const declaration = statement.childForFieldName("declaration");
    const declarationName = declaration?.childForFieldName("name")?.text;
    if (declarationName != null) {
      names.add(declarationName);
    }

    for (const declarator of declaration?.namedChildren ?? []) {
      if (declarator.type !== "variable_declarator") {
        continue;
      }
      const declaratorName = declarator.childForFieldName("name")?.text;
      if (declaratorName != null) {
        names.add(declaratorName);
      }
    }

    for (const specifier of statement.descendantsOfType("export_specifier")) {
      const specifierName = specifier.childForFieldName("name")?.text;
      if (specifierName != null) {
        names.add(specifierName);
      }
    }
  }

  return names;
}

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
      const parseError = root.hasError();
      const exportedNames = collectExportedNames(root);

      let apiSurface = 0;
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

        if (AST_COMPLEXITY_NODES.has(nodeType)) {
          complexity += 1 + currentNesting;
          maxNesting = Math.max(maxNesting, currentNesting);
        }

        if (spec.imports.types.includes(nodeType)) {
          const nodeText = cursor.nodeText;
          spec.imports.patterns.forEach((re) => {
            const match = nodeText.match(re);
            if (match?.[1]) {
              imports.add(match[1]);
            }
          });
        }

        if (declarationTypes.has(nodeType)) {
          const node = cursor.currentNode();
          const name = nodeName(node);
          if (name != null) {
            const kind = declarationKindByType.get(nodeType) ?? "function";
            symbols.push({
              confidence: CONFIDENCE_LEVELS.astSymbol,
              exported: exportedNames.has(name) || node.parent?.type === "export_statement",
              kind,
              line: node.startPosition.row + 1,
              name,
              path: file.path,
            });
          }
        }

        if (spec.api?.some((re) => re.test(cursor.nodeText))) {
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

      const framework = detectRouteFramework(imports);
      const routes = dedupeRoutes(
        collectRoutes(file, spec).map((route) => ({
          ...route,
          framework: route.framework === "js-ts-router" ? framework : route.framework,
        })),
      );
      const exportedCount = new Set(
        symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name),
      ).size;
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
        confidence: parseError ? CONFIDENCE_LEVELS.astPartial : CONFIDENCE_LEVELS.astStructure,
        entrypointHint: spec.entrypoints.some((re) => re.test(file.content)),
        exports: exportedCount,
        frameworkHints,
        imports: Array.from(imports),
        parseError,
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
