import path from "node:path";
import ts from "typescript";

import type { TsStaticHint } from "@/server/shared/types";

import { normalizeRepoPath } from "../core/common";

const TS_LIKE = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

const LONG_FN_LINES = 80;
const MANY_PARAMS = 7;

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
    } catch {
      continue;
    }

    const visit = (node: ts.Node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        hints.push({
          detail: "Explicit `any` weakens type safety.",
          kind: "explicit-any",
          line: line + 1,
          path: normalized,
        });
        return;
      }

      if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node)
      ) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const lineSpan = end.line - start.line + 1;
        if (lineSpan >= LONG_FN_LINES) {
          hints.push({
            detail: `Function spans ~${lineSpan} lines (threshold ${LONG_FN_LINES}).`,
            kind: "long-function",
            line: start.line + 1,
            path: normalized,
          });
        }

        const paramCount = node.parameters.length;
        if (paramCount >= MANY_PARAMS) {
          hints.push({
            detail: `Function has ${paramCount} parameters (threshold ${MANY_PARAMS - 1}).`,
            kind: "many-params",
            line: start.line + 1,
            path: normalized,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return hints;
}
