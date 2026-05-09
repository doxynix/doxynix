import { extname } from "pathe";
import ts from "typescript";

import type { TsStaticHint } from "../../types";
import { normalizeRepoPath } from "../core/common";
import { COMPLEXITY_SCORING } from "../core/scoring-constants";

const TS_LIKE = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

type VisitContext = {
  hints: TsStaticHint[];
  normalizedPath: string;
  sourceFile: ts.SourceFile;
};

const visitNode = (node: ts.Node, context: VisitContext) => {
  const { hints, normalizedPath, sourceFile } = context;

  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    const startPos = node.getStart(sourceFile);
    const { line } = sourceFile.getLineAndCharacterOfPosition(startPos);
    hints.push({
      detail: "Explicit `any` weakens type safety.",
      kind: "explicit-any",
      line: line + 1,
      path: normalizedPath,
    });
    return;
  }

  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    const nodeStart = node.getStart(sourceFile);
    const nodeEnd = node.getEnd();

    const start = sourceFile.getLineAndCharacterOfPosition(nodeStart);
    const end = sourceFile.getLineAndCharacterOfPosition(nodeEnd);
    const lineSpan = end.line - start.line + 1;

    if (lineSpan >= COMPLEXITY_SCORING.lineCountThreshold) {
      hints.push({
        detail: `Function spans ~${lineSpan} lines (threshold ${COMPLEXITY_SCORING.lineCountThreshold}).`,
        kind: "long-function",
        line: start.line + 1,
        path: normalizedPath,
      });
    }

    const paramCount = node.parameters.length;
    if (paramCount >= COMPLEXITY_SCORING.paramCountThreshold) {
      hints.push({
        detail: `Function has ${paramCount} parameters (threshold ${COMPLEXITY_SCORING.paramCountThreshold}).`,
        kind: "many-params",
        line: start.line + 1,
        path: normalizedPath,
      });
    }
  }

  ts.forEachChild(node, (child) => visitNode(child, context));
};

function scriptKind(filePath: string): ts.ScriptKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (lower.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  if (lower.endsWith(".cts") || lower.endsWith(".mts")) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.TS;
}

export function collectTypeScriptStaticHints(
  files: { content: string; path: string }[]
): TsStaticHint[] {
  const hints: TsStaticHint[] = [];

  for (const file of files) {
    const normalized = normalizeRepoPath(file.path);
    const ext = extname(normalized).toLowerCase();
    if (!TS_LIKE.has(ext)) continue;

    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(
        normalized,
        file.content,
        ts.ScriptTarget.Latest,
        false,
        scriptKind(normalized)
      );

      visitNode(sourceFile, { hints, normalizedPath: normalized, sourceFile });
    } catch {
      continue;
    }
  }

  return hints;
}
