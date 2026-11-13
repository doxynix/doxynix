import { uniq } from "es-toolkit";
import type Parser from "web-tree-sitter";

import { appLogger } from "@/server/core/app-logger";
import {
  getParserForExt,
  getSpecByExt,
  type LanguageSpec,
  loadLanguage,
  type SymbolKind,
} from "@/server/core/tree-sitter";
import { compileQuery } from "@/server/core/tree-sitter/query-cache";

import { extractCallSites } from "../core/call-graph";
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

const CLASS_NODE_TYPES = new Set([
  "abstract_class_declaration",
  "class_declaration",
  "class_definition",
  "class_specifier",
]);

const IMPORT_KIND_PRECEDENCE: ReadonlyArray<readonly [capture: string, kind: ImportKind]> = [
  ["import.named", "named"],
  ["import.default", "default"],
  ["import.namespace", "namespace"],
  ["import.require", "require"],
  ["import.dynamic", "dynamic"],
  ["import.reexport", "reexport"],
];

type ImportDraft = {
  captureNames: Set<string>;
  defaultNames: string[];
  line: number;
  namedNames: string[];
  namespaceNames: string[];
  source: string;
};

function stripQuotes(text: string): string {
  return text.replaceAll(/^["'`]|["'`]$/gu, "");
}

// Method declarations also occur in object literals, so only a real class ancestor counts.
function findClassContainer(node: Parser.SyntaxNode | undefined): string | undefined {
  let current = node?.parent ?? null;

  while (current != null) {
    if (CLASS_NODE_TYPES.has(current.type)) {
      return current.childForFieldName("name")?.text;
    }
    current = current.parent;
  }

  return undefined;
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
  const captured = new Set(names);
  for (const [capture, kind] of IMPORT_KIND_PRECEDENCE) {
    if (captured.has(capture)) {
      return kind;
    }
  }
  return "side-effect";
}

function importAnchor(captures: Map<string, Parser.SyntaxNode[]>): Parser.SyntaxNode | undefined {
  return (
    firstCapture(captures, "import.statement") ??
    firstCapture(captures, "import.reexport") ??
    firstCapture(captures, "import.require") ??
    firstCapture(captures, "import.dynamic")
  );
}

function importNames(captures: Map<string, Parser.SyntaxNode[]>, name: string): string[] {
  return (captures.get(name) ?? []).map((node) => node.text);
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
    const symbolDeclarations = new Map<string, Parser.SyntaxNode>();
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
            const line = (declaration ?? nameNode).startPosition.row + 1;
            const exported =
              exportedNames.has(name) ||
              querySpec.isExported?.(declaration ?? nameNode, name) === true ||
              declaration?.parent?.type === "export_statement";
            // A declarator carries the name; its value node carries the signature.
            const signatureNode =
              declaration?.type === "variable_declarator"
                ? (declaration.childForFieldName("value") ?? declaration)
                : declaration;
            const parameters = signatureNode?.childForFieldName("parameters")?.text;
            const returnType = signatureNode?.childForFieldName("return_type")?.text;
            const container = kind === "method" ? findClassContainer(declaration) : undefined;

            symbolDeclarations.set(`${name}:${line}`, signatureNode ?? nameNode);

            symbols.push({
              confidence: CONFIDENCE_LEVELS.astSymbol,
              container,
              exported,
              kind,
              line,
              name,
              parameters,
              path: file.path,
              returnType,
              signature: parameters == null ? name : `${name}${parameters}${returnType ?? ""}`,
            });
          }
        }
      }
    }

    const functionComplexities = symbols
      .map((symbol) => {
        const declaration = symbolDeclarations.get(`${symbol.name}:${symbol.line ?? 1}`);
        const body = declaration?.childForFieldName("body");
        if (body == null) {
          return null;
        }

        return {
          complexity: 1 + body.descendantsOfType(querySpec.complexityNodeTypes).length,
          line: symbol.line ?? 1,
          maxNesting: computeMaxNesting(body, querySpec.nestingNodeTypes),
          name: symbol.name,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    const importQuery = await compileOptionalQuery(ext, languageSpec, querySpec.imports);
    if (importQuery != null) {
      const drafts = new Map<number, ImportDraft>();

      for (const match of importQuery.matches(root)) {
        const captures = capturesByName(match.captures);
        const sourceNode = firstCapture(captures, "import.source");
        if (sourceNode == null) {
          continue;
        }

        const anchor = importAnchor(captures) ?? sourceNode;
        const draft = drafts.get(anchor.id);
        const source = stripQuotes(sourceNode.text);

        if (draft == null) {
          drafts.set(anchor.id, {
            captureNames: new Set(captures.keys()),
            defaultNames: importNames(captures, "import.default"),
            line: anchor.startPosition.row + 1,
            namedNames: importNames(captures, "import.named"),
            namespaceNames: importNames(captures, "import.namespace"),
            source,
          });
          continue;
        }

        for (const captureName of captures.keys()) {
          draft.captureNames.add(captureName);
        }
        draft.defaultNames.push(...importNames(captures, "import.default"));
        draft.namedNames.push(...importNames(captures, "import.named"));
        draft.namespaceNames.push(...importNames(captures, "import.namespace"));
      }

      for (const draft of drafts.values()) {
        imports.add(draft.source);
        importDetails.push({
          kind: importKindFromCaptures(draft.captureNames),
          line: draft.line,
          names: uniq([...draft.defaultNames, ...draft.namedNames, ...draft.namespaceNames]),
          source: draft.source,
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

    const calls = await extractCallSites(file, ext, querySpec);

    const frameworkHints = collectFrameworkFactsFromTokens(
      [...imports, file.path, ...symbols.map((symbol) => symbol.name)],
      file.path,
      78,
    );

    return {
      analysisMode: "tree-sitter",
      apiSurface: routes.length,
      calls,
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
      functionComplexities,
      importDetails,
      imports: Array.from(imports),
      parseError: root.hasError(),
      path: file.path,
      routes,
      source: "extraction",
      symbols,
    };
  } catch (error) {
    appLogger.error({
      error,
      ext,
      msg: "Tree-sitter query extraction failed",
      path: file.path,
    });
    return null;
  } finally {
    tree?.delete();
  }
}
