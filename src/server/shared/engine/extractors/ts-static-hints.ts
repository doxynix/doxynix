import path from "node:path";
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
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    hints.push({
      detail: "Explicit `any` weakens type safety.",
      kind: "explicit-any",
      line: line + 1,
      path: normalizedPath,
    });
    return;
  }

  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
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
        detail: `Function has ${paramCount} parameters (threshold ${COMPLEXITY_SCORING.paramCountThreshold - 1}).`,
        kind: "many-params",
        line: start.line + 1,
        path: normalizedPath,
      });
    }
  }

  ts.forEachChild(node, (child) => visitNode(child, context));
};

function scriptKind(filePath: string) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

export function collectTypeScriptStaticHints(
  files: { content: string; path: string }[]
): TsStaticHint[] {
  const hints: TsStaticHint[] = [];

  for (const file of files) {
    const normalized = normalizeRepoPath(file.path);
    const ext = path.posix.extname(normalized).toLowerCase();
    if (!TS_LIKE.has(ext)) continue;

    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(
        normalized,
        file.content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(normalized)
      );

      visitNode(sourceFile, { hints, normalizedPath: normalized, sourceFile });
    } catch {
      continue;
    }
  }

  return hints;
}
