import type Parser from "web-tree-sitter";

import {
  getParserForExt,
  getSpecByExt,
  type LanguageSpec,
  loadLanguage,
  type SymbolKind,
} from "@/server/core/tree-sitter";
import { compileQuery } from "@/server/core/tree-sitter/query-cache";

import type {
  EntrypointRef,
  FileSignals,
  ImportKind,
  ImportRef,
  RepositoryFile,
  RouteRef,
  SymbolRef,
} from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";
import { CONFIDENCE_LEVELS } from "../core/scoring-constants";
import { capturesByName, firstCapture } from "./queries/captures";
import type { LanguageQuerySpec } from "./queries/types";

const ROUTE_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

const IMPORT_KIND_BY_CAPTURE: Record<string, ImportKind> = {
  "import.default": "default",
  "import.dynamic": "dynamic",
  "import.named": "named",
  "import.namespace": "namespace",
  "import.reexport": "reexport",
  "import.require": "require",
  "import.side_effect": "side-effect",
};

function stripQuotes(text: string): string {
  return text.replaceAll(/^["'`]|["'`]$/gu, "");
}

async function compileOptionalQuery(
  ext: string,
  spec: LanguageSpec,
  source: string,
): Promise<Parser.Query | null> {
  if (source.trim().length === 0) {
    return null;
  }
  return compileQuery(ext, spec, source);
}

async function collectExportedNames(
  ext: string,
  spec: LanguageSpec,
  source: string,
  root: Parser.SyntaxNode,
): Promise<Set<string>> {
  const names = new Set<string>();
  const query = await compileOptionalQuery(ext, spec, source);
  if (query == null) {
    return names;
  }

  for (const capture of query.captures(root)) {
    if (capture.name === "export.name") {
      names.add(capture.node.text);
    }
  }

  return names;
}

function importKindFromCaptures(names: Iterable<string>): ImportKind {
  for (const name of names) {
    const kind = IMPORT_KIND_BY_CAPTURE[name];
    if (kind != null) {
      return kind;
    }
  }
  return "side-effect";
}

function computeMaxNesting(root: Parser.SyntaxNode, nestingNodeTypes: string[]): number {
  const nesting = new Set(nestingNodeTypes);
  let maxNesting = 0;
  let currentNesting = 0;
  const cursor = root.walk();

  try {
    let reachedRoot = false;
    while (!reachedRoot) {
      if (nesting.has(cursor.nodeType)) {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      }

      if (cursor.gotoFirstChild()) {
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
          if (nesting.has(cursor.nodeType)) {
            currentNesting = Math.max(0, currentNesting - 1);
          }
          if (cursor.gotoNextSibling()) {
            backtrack = false;
          }
        }
      }
    }
  } finally {
    cursor.delete();
  }

  return maxNesting;
}

export async function collectQuerySignals(
  file: RepositoryFile,
  ext: string,
  querySpec: LanguageQuerySpec,
): Promise<FileSignals | null> {
  const languageSpec = getSpecByExt(ext);
  if (languageSpec == null) {
    return null;
  }

  let tree: Parser.Tree | undefined;

  try {
    const parser = await getParserForExt(ext);
    const language = await loadLanguage(ext, languageSpec);
    parser.setLanguage(language);
    tree = parser.parse(file.content);
    const root = tree.rootNode;

    const symbols: SymbolRef[] = [];
    const imports = new Set<string>();
    const importDetails: ImportRef[] = [];
    const routes: RouteRef[] = [];
    const entrypoints: EntrypointRef[] = [];

    const exportedNames = await collectExportedNames(ext, languageSpec, querySpec.exports, root);

    const symbolQuery = await compileOptionalQuery(ext, languageSpec, querySpec.symbols);
    if (symbolQuery != null) {
      for (const match of symbolQuery.matches(root)) {
        const captures = capturesByName(match.captures);

        for (const [captureName, nameNodes] of captures) {
          const parsed = /^symbol\.([a-z]+)\.name$/u.exec(captureName);
          if (parsed == null) {
            continue;
          }

          const kind = parsed[1] as SymbolKind;
          const declaration = firstCapture(captures, `symbol.${kind}`);

          for (const nameNode of nameNodes) {
            const name = nameNode.text;
            const exported =
              exportedNames.has(name) ||
              querySpec.isExported?.(declaration ?? nameNode, name) === true ||
              declaration?.parent?.type === "export_statement";

            symbols.push({
              confidence: CONFIDENCE_LEVELS.astSymbol,
              exported,
              kind,
              line: (declaration ?? nameNode).startPosition.row + 1,
              name,
              path: file.path,
            });
          }
        }
      }
    }

    const importQuery = await compileOptionalQuery(ext, languageSpec, querySpec.imports);
    if (importQuery != null) {
      const seenImportDetails = new Set<string>();

      for (const match of importQuery.matches(root)) {
        const captures = capturesByName(match.captures);
        const sourceNode = firstCapture(captures, "import.source");
        if (sourceNode == null) {
          continue;
        }

        const source = stripQuotes(sourceNode.text);
        imports.add(source);
        const line =
          (firstCapture(captures, "import.statement") ?? sourceNode).startPosition.row + 1;
        const names = [
          ...(captures.get("import.default") ?? []),
          ...(captures.get("import.named") ?? []),
          ...(captures.get("import.namespace") ?? []),
        ].map((node) => node.text);
        const kind = importKindFromCaptures(captures.keys());
        const key = `${kind}:${source}:${names.join(",")}`;
        if (seenImportDetails.has(key)) {
          continue;
        }
        seenImportDetails.add(key);

        importDetails.push({
          kind,
          line,
          names,
          source,
        });
      }
    }

    const routeQuery = await compileOptionalQuery(ext, languageSpec, querySpec.routes);
    if (routeQuery != null) {
      const framework = querySpec.detectFramework?.(imports);
      const seen = new Set<string>();

      for (const match of routeQuery.matches(root)) {
        const captures = capturesByName(match.captures);
        const methodNode = firstCapture(captures, "route.method");
        const pathNode = firstCapture(captures, "route.path");
        if (methodNode == null || pathNode == null) {
          continue;
        }

        const rawMethod = methodNode.text;
        const method = (querySpec.normalizeRouteMethod?.(rawMethod) ?? rawMethod).toUpperCase();
        if (!ROUTE_METHODS.has(method)) {
          continue;
        }

        const routePath = stripQuotes(pathNode.text);
        const key = `${method}:${routePath}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        routes.push({
          confidence: CONFIDENCE_LEVELS.astRoute,
          framework,
          kind: "http",
          line: methodNode.startPosition.row + 1,
          method,
          path: routePath,
          sourcePath: file.path,
        });
      }
    }

    const entrypointQuery = await compileOptionalQuery(ext, languageSpec, querySpec.entrypoints);
    if (entrypointQuery != null) {
      for (const capture of entrypointQuery.captures(root)) {
        if (capture.name !== "entrypoint.runtime") {
          continue;
        }
        entrypoints.push({
          confidence: CONFIDENCE_LEVELS.astRoute,
          kind: "runtime",
          path: file.path,
          reason: `Tree-sitter entrypoint: ${capture.node.text.split("\n")[0] ?? ""}`,
        });
      }
    }

    const complexityQuery = await compileOptionalQuery(
      ext,
      languageSpec,
      querySpec.complexity ?? "",
    );
    const complexity =
      complexityQuery?.captures(root).filter((capture) => capture.name === "complexity.branch")
        .length ?? 0;

    const frameworkHints = collectFrameworkFactsFromTokens(
      [...imports, file.path, ...symbols.map((symbol) => symbol.name)],
      file.path,
      78,
    );

    return {
      analysisMode: "tree-sitter",
      apiSurface: routes.length,
      complexityMetrics: {
        complexity,
        maxNesting: computeMaxNesting(root, querySpec.nestingNodeTypes),
      },
      confidence: root.hasError() ? CONFIDENCE_LEVELS.astPartial : CONFIDENCE_LEVELS.astStructure,
      entrypointHint: entrypoints.length > 0,
      entrypointRefs: entrypoints,
      exports: new Set(symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name))
        .size,
      frameworkHints,
      importDetails,
      imports: Array.from(imports),
      parseError: root.hasError(),
      path: file.path,
      routes,
      source: "extraction",
      symbols,
    };
  } finally {
    tree?.delete();
  }
}
