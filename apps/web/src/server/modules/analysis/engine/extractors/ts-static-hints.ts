import { extname, normalize } from "pathe";

import type { TsStaticHint } from "@/server/utils/types";

import { COMPLEXITY_SCORING } from "../core/scoring-constants";

const TS_LIKE = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

const EXPLICIT_ANY_REGEX = /(?::\s*any\b|\bas\s+any\b|<any>|\bany\[\])/;
const FN_HEADER_REGEX =
  /(?:function\b[^(]*\(([^)]*)\)|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>|\b\w+\s*\(([^)]*)\)\s*\{)/;

function analyzeLinesForHints(content: string, normalizedPath: string, hints: TsStaticHint[]) {
  const lines = content.split(/\r?\n/u);
  const totalLines = lines.length;

  let inBlockComment = false;

  for (let idx = 0; idx < totalLines; idx++) {
    const rawLine = lines[idx]!;
    const lineNum = idx + 1;

    if (inBlockComment) {
      if (rawLine.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    if (rawLine.includes("/*")) {
      inBlockComment = true;
      continue;
    }

    const cleanLine = rawLine.split("//")[0]?.trim() ?? "";
    if (cleanLine.length === 0) {
      continue;
    }

    if (EXPLICIT_ANY_REGEX.test(cleanLine)) {
      hints.push({
        detail: "Explicit `any` weakens type safety.",
        kind: "explicit-any",
        line: lineNum,
        path: normalizedPath,
      });
    }

    const fnMatch = FN_HEADER_REGEX.exec(cleanLine);
    if (fnMatch != null) {
      const paramStr = fnMatch[1] ?? fnMatch[2] ?? fnMatch[3] ?? "";
      const paramCount = paramStr
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0).length;

      if (paramCount >= COMPLEXITY_SCORING.paramCountThreshold) {
        hints.push({
          detail: `Function has ${paramCount} parameters (threshold ${COMPLEXITY_SCORING.paramCountThreshold}).`,
          kind: "many-params",
          line: lineNum,
          path: normalizedPath,
        });
      }
    }
  }

  let fnStartLine = 0;
  let braceDepth = 0;
  let trackingFn = false;

  for (let idx = 0; idx < totalLines; idx++) {
    const line = lines[idx]!;
    const lineNum = idx + 1;

    if (
      !trackingFn &&
      (line.includes("function") || line.includes("=>") || /\b\w+\s*\(.*?\)\s*\{/.test(line))
    ) {
      fnStartLine = lineNum;
      trackingFn = true;
    }

    const openCount = (line.match(/{/g) ?? []).length;
    const closeCount = (line.match(/}/g) ?? []).length;
    braceDepth += openCount - closeCount;

    if (trackingFn && braceDepth <= 0) {
      const lineSpan = lineNum - fnStartLine + 1;
      if (lineSpan >= COMPLEXITY_SCORING.lineCountThreshold) {
        hints.push({
          detail: `Function spans ~${lineSpan} lines (threshold ${COMPLEXITY_SCORING.lineCountThreshold}).`,
          kind: "long-function",
          line: fnStartLine,
          path: normalizedPath,
        });
      }
      trackingFn = false;
      braceDepth = 0;
    }
  }
}

export function collectTypeScriptStaticHints(
  files: { content: string; path: string }[],
): TsStaticHint[] {
  const hints: TsStaticHint[] = [];

  for (const file of files) {
    const normalized = normalize(file.path);
    const ext = extname(normalized).toLowerCase();
    if (!TS_LIKE.has(ext)) {
      continue;
    }

    try {
      analyzeLinesForHints(file.content, normalized, hints);
    } catch {}
  }

  return hints;
}
