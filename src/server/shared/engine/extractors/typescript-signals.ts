import ts from "typescript";

import type {
  EntrypointRef,
  FileSignals,
  FrameworkFact,
  RepositoryFile,
  RouteRef,
  SymbolKind,
  SymbolRef,
} from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";
import { CONFIDENCE_LEVELS } from "../core/scoring-constants";

function getScriptKind(filePath: string) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function hasExportModifier(modifiers: ts.NodeArray<ts.ModifierLike> | undefined) {
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

const HTTP_METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put"]);

function getNodeLine(sourceFile: ts.SourceFile, node: ts.Node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function nodeName(node: ts.Node): string | undefined {
  const namedNode = "name" in node ? (node as ts.Node & { name?: ts.Node }) : undefined;

  return namedNode?.name != null && ts.isIdentifier(namedNode.name)
    ? namedNode.name.text
    : undefined;
}

function pushSymbol(
  symbols: SymbolRef[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: SymbolKind,
  exported: boolean,
  fallbackName?: string
) {
  const name = fallbackName ?? nodeName(node);
  if (name == null || name.length === 0) return;

  symbols.push({
    confidence: exported ? CONFIDENCE_LEVELS.tsCompiler : 75,
    exported,
    kind,
    line: getNodeLine(sourceFile, node),
    name,
    path: sourceFile.fileName,
  });
}

function literalPath(argument: ts.Expression | undefined): string | undefined {
  return argument != null &&
    (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : undefined;
}

function collectCallRoute(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  routes: RouteRef[],
  frameworkHints: FrameworkFact[]
) {
  if (!ts.isPropertyAccessExpression(node.expression)) return;

  const methodName = node.expression.name.text;
  const normalizedMethod = methodName.toLowerCase();
  const path = literalPath(node.arguments[0]);
  const receiver = node.expression.expression.getText(sourceFile);

  if (HTTP_METHODS.has(normalizedMethod) && path != null) {
    routes.push({
      confidence: CONFIDENCE_LEVELS.tsInferred,
      framework: frameworkHints[0]?.name,
      kind: "http",
      line: getNodeLine(sourceFile, node),
      method: normalizedMethod.toUpperCase(),
      path,
      sourcePath: sourceFile.fileName,
    });
    return;
  }

  if (methodName === "route" && path != null) {
    routes.push({
      confidence: 72,
      framework:
        frameworkHints[0]?.name ?? (receiver.toLowerCase().includes("hono") ? "Hono" : undefined),
      kind: "http",
      line: getNodeLine(sourceFile, node),
      method: "ROUTE",
      path,
      sourcePath: sourceFile.fileName,
    });
  }
}

export function collectTypeScriptSignals(file: RepositoryFile): FileSignals {
  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(file.path)
  );

  // dumpDebug(`ast-ts-${path.basename(file.path)}`, {
  //   path: file.path,
  //   kind: "TypeScript-Native-AST",
  //   nodes: sourceFile.statements.map(s => ({
  //     kind: ts.SyntaxKind[s.kind],
  //     name: (s as any).name?.escapedText || "anonymous",
  //     pos: s.pos,
  //     end: s.end
  //   }))
  // });

  const imports: string[] = [];
  let apiSurface = 0;
  let exports = 0;
  const symbols: SymbolRef[] = [];
  const routes: RouteRef[] = [];
  const frameworkTokens = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
      frameworkTokens.add(node.moduleSpecifier.text);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
      exports += node.exportClause != null ? 1 : 0;
    }

    if (ts.isExportAssignment(node)) {
      exports += 1;
      pushSymbol(symbols, sourceFile, node, "module", true, "default");
    }

    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      hasExportModifier(node.modifiers)
    ) {
      exports += 1;
      const kind = ts.isFunctionDeclaration(node)
        ? "function"
        : ts.isClassDeclaration(node)
          ? "class"
          : ts.isInterfaceDeclaration(node)
            ? "interface"
            : ts.isTypeAliasDeclaration(node)
              ? "type"
              : "enum";
      pushSymbol(symbols, sourceFile, node, kind, true);
    }

    if (ts.isVariableStatement(node) && hasExportModifier(node.modifiers)) {
      exports += node.declarationList.declarations.length;
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          pushSymbol(symbols, sourceFile, declaration, "variable", true, declaration.name.text);
        }
      }
    }

    if (ts.isFunctionDeclaration(node)) {
      pushSymbol(symbols, sourceFile, node, "function", hasExportModifier(node.modifiers));
    }

    if (ts.isClassDeclaration(node)) {
      pushSymbol(symbols, sourceFile, node, "class", hasExportModifier(node.modifiers));
    }

    if (ts.isInterfaceDeclaration(node)) {
      pushSymbol(symbols, sourceFile, node, "interface", hasExportModifier(node.modifiers));
    }

    if (ts.isTypeAliasDeclaration(node)) {
      pushSymbol(symbols, sourceFile, node, "type", hasExportModifier(node.modifiers));
    }

    if (ts.isEnumDeclaration(node)) {
      pushSymbol(symbols, sourceFile, node, "enum", hasExportModifier(node.modifiers));
    }

    if (ts.isMethodDeclaration(node)) {
      pushSymbol(symbols, sourceFile, node, "method", false);
    }

    if (ts.isCallExpression(node)) {
      const frameworkHints = collectFrameworkFactsFromTokens(frameworkTokens, file.path, 90);
      collectCallRoute(node, sourceFile, routes, frameworkHints);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  [
    /\bnew\s+Hono\s*\(/,
    /\bexpress\s*\(/,
    /\bfastify\s*\(/,
    /\bNestFactory\.create\b/,
    /\bcreateTRPCRouter\b/,
    /\brouter\.(get|post|put|patch|delete)\b/gi,
  ].forEach((pattern) => {
    if (pattern.test(file.content)) frameworkTokens.add(pattern.source);
  });

  const frameworkHints = collectFrameworkFactsFromTokens(
    [...imports, ...Array.from(frameworkTokens)],
    file.path,
    90
  );

  apiSurface += (
    file.content.match(/\b(publicProcedure|protectedProcedure|adminProcedure)\b/g) ?? []
  ).length;
  apiSurface += (file.content.match(/\b(GET|POST|PUT|PATCH|DELETE)\b\s*[(:=]/g) ?? []).length;

  const entrypointRefs: EntrypointRef[] = [];
  const entrypointHint =
    /\bcreateServer\b|\bNestFactory\.create\b|\bnew Hono\b|\bexpress\(|\bif\s*\(\s*require\.main\s*===\s*module\s*\)|\bserve\(/.test(
      file.content
    );

  if (entrypointHint) {
    entrypointRefs.push({
      confidence: 78,
      kind: "runtime",
      path: file.path,
      reason: "runtime bootstrap pattern detected in TypeScript/JavaScript source",
    });
  }

  if (exports > 0 && /\/index\.[cm]?[jt]sx?$/i.test(file.path)) {
    entrypointRefs.push({
      confidence: 66,
      kind: "library",
      path: file.path,
      reason: "exporting index file suggests package public surface",
    });
  }

  return {
    analysisMode: "typescript-ast",
    apiSurface,
    confidence: CONFIDENCE_LEVELS.tsCompiler, // TypeScript compiler has very high confidence
    entrypointHint,
    entrypointRefs,
    exports,
    frameworkHints,
    imports,
    path: file.path,
    routes,
    source: "extraction" as const,
    symbols,
  };
}
