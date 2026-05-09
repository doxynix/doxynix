import type { FileSignals, RepositoryFile, RouteRef, SymbolRef } from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";
import { CONFIDENCE_LEVELS } from "../core/scoring-constants";
import {
  getRegexSignalSpec,
  type RegexRoutePattern,
  type RegexSignalSpec,
  type RegexSymbolPattern,
} from "./regex-signal-specs";

// ЭТАЛОН: Быстрый подсчет совпадений без создания тяжелых JS-массивов в оперативной памяти
function countRegexMatches(content: string, patterns: RegExp[]): number {
  let total = 0;
  for (const pattern of patterns) {
    // Сбрасываем индекс регулярного выражения перед поиском
    pattern.lastIndex = 0;
    while (pattern.exec(content) !== null) {
      total++;
    }
  }
  return total;
}

function collectRegexMatches(content: string, patterns: RegExp[]): string[] {
  const values: string[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      if (typeof match[1] === "string" && match[1].trim().length > 0) {
        values.push(match[1].trim());
      }
    }
  }
  return values;
}

class LineMap {
  private lineOffsets: number[] = [0];

  constructor(content: string) {
    let offset = 0;
    while (true) {
      const index = content.indexOf("\n", offset);
      if (index === -1) break;
      offset = index + 1;
      this.lineOffsets.push(offset);
    }
  }

  getLineByOffset(offset: number): number {
    let low = 0;
    let high = this.lineOffsets.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const midOffset = this.lineOffsets[mid]!;

      if (midOffset === offset) {
        return mid + 1;
      } else if (midOffset < offset) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return low;
  }
}

function collectSymbols(
  filePath: string,
  content: string,
  patterns: RegexSymbolPattern[],
  lineMap: LineMap
): SymbolRef[] {
  const symbols: SymbolRef[] = [];

  for (const { exported = false, kind, pattern } of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const name = typeof match[1] === "string" ? match[1].trim() : "";
      if (name.length === 0) continue;

      const startOffset = match.index;

      symbols.push({
        confidence: exported ? CONFIDENCE_LEVELS.regexExported : CONFIDENCE_LEVELS.regexInternal,
        exported,
        kind,
        line: lineMap.getLineByOffset(startOffset),
        name,
        path: filePath,
      });
    }
  }

  return symbols;
}

function collectRoutes(
  filePath: string,
  content: string,
  patterns: RegexRoutePattern[],
  lineMap: LineMap
): RouteRef[] {
  const routes: RouteRef[] = [];

  for (const { confidence = 65, framework, methodIndex, pathIndex, pattern } of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const method =
        typeof match[methodIndex] === "string" ? match[methodIndex].toUpperCase() : undefined;
      const routePath = typeof match[pathIndex] === "string" ? match[pathIndex] : undefined;
      if (method == null || routePath == null || routePath.length === 0) continue;

      const startOffset = match.index;

      routes.push({
        confidence,
        framework,
        kind: "http",
        line: lineMap.getLineByOffset(startOffset),
        method,
        path: routePath,
        sourcePath: filePath,
      });
    }
  }

  return routes;
}

function buildSignals(
  file: RepositoryFile,
  params: {
    apiSurface: number;
    entrypointHint: boolean;
    exports: number;
    extraFrameworkTokens?: string[];
    imports: string[];
    routes?: RouteRef[];
    symbols?: SymbolRef[];
  }
): FileSignals {
  const frameworkHints = collectFrameworkFactsFromTokens(
    [...params.imports, ...(params.extraFrameworkTokens ?? []), file.path],
    file.path,
    CONFIDENCE_LEVELS.manifestMatch
  );

  return {
    analysisMode: "heuristic",
    apiSurface: params.apiSurface,
    complexityMetrics: {
      complexity: 0, // TODO: посчитать
      maxNesting: 0,
    },
    confidence: 60,
    entrypointHint: params.entrypointHint,
    exports: params.exports,
    frameworkHints,
    imports: params.imports,
    path: file.path,
    routes: params.routes ?? [],
    source: "extraction" as const,
    symbols: params.symbols ?? [],
  };
}

function buildSignalsFromRegexSpec(file: RepositoryFile, spec: RegexSignalSpec): FileSignals {
  const lineMap = new LineMap(file.content);

  return buildSignals(file, {
    apiSurface: countRegexMatches(file.content, spec.apiSurfacePatterns),
    entrypointHint: spec.entrypointHint(file),
    exports: countRegexMatches(file.content, spec.exportPatterns),
    extraFrameworkTokens: spec.extraFrameworkTokens?.(file),
    imports: collectRegexMatches(file.content, spec.importPatterns),
    routes: collectRoutes(file.path, file.content, spec.routePatterns ?? [], lineMap),
    symbols: collectSymbols(file.path, file.content, spec.symbolPatterns, lineMap),
  });
}

export function collectRegexSignals(file: RepositoryFile): FileSignals {
  return buildSignalsFromRegexSpec(file, getRegexSignalSpec(file));
}
