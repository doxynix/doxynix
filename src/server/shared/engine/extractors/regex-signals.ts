import type { FileSignals, RepositoryFile, RouteRef, SymbolRef } from "../core/discovery.types";
import { collectFrameworkFactsFromTokens } from "../core/framework-catalog";
import {
  getRegexSignalSpec,
  type RegexRoutePattern,
  type RegexSignalSpec,
  type RegexSymbolPattern,
} from "./regex-signal-specs";

function collectRegexMatches(content: string, patterns: RegExp[]) {
  const values: string[] = [];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (typeof match[1] === "string" && match[1].trim().length > 0) {
        values.push(match[1].trim());
      }
    }
  }
  return values;
}

function countRegexMatches(content: string, patterns: RegExp[]) {
  let total = 0;
  for (const pattern of patterns) {
    total += Array.from(content.matchAll(pattern)).length;
  }
  return total;
}

function lineOf(content: string, fragment: string) {
  const index = content.indexOf(fragment);
  if (index < 0) return undefined;
  return content.slice(0, index).split(/\r?\n/u).length;
}

function collectSymbols(filePath: string, content: string, patterns: RegexSymbolPattern[]) {
  const symbols: SymbolRef[] = [];

  for (const { exported = false, kind, pattern } of patterns) {
    for (const match of content.matchAll(pattern)) {
      const name = typeof match[1] === "string" ? match[1].trim() : "";
      if (name.length === 0) continue;
      symbols.push({
        confidence: exported ? 75 : 60,
        exported,
        kind,
        line: lineOf(content, match[0]),
        name,
        path: filePath,
      });
    }
  }

  return symbols;
}

function collectRoutes(filePath: string, content: string, patterns: RegexRoutePattern[]) {
  const routes: RouteRef[] = [];

  for (const { confidence = 65, framework, methodIndex, pathIndex, pattern } of patterns) {
    for (const match of content.matchAll(pattern)) {
      const method =
        typeof match[methodIndex] === "string" ? match[methodIndex].toUpperCase() : undefined;
      const routePath = typeof match[pathIndex] === "string" ? match[pathIndex] : undefined;
      if (method == null || routePath == null || routePath.length === 0) continue;
      routes.push({
        confidence,
        framework,
        kind: "http",
        line: lineOf(content, match[0]),
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
    70
  );

  return {
    analysisMode: "heuristic",
    apiSurface: params.apiSurface,
    confidence: 60, // Regex-based extraction has moderate confidence
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
  return buildSignals(file, {
    apiSurface: countRegexMatches(file.content, spec.apiSurfacePatterns),
    entrypointHint: spec.entrypointHint(file),
    exports: countRegexMatches(file.content, spec.exportPatterns),
    extraFrameworkTokens: spec.extraFrameworkTokens?.(file),
    imports: collectRegexMatches(file.content, spec.importPatterns),
    routes: collectRoutes(file.path, file.content, spec.routePatterns ?? []),
    symbols: collectSymbols(file.path, file.content, spec.symbolPatterns),
  });
}

export function collectRegexSignals(file: RepositoryFile): FileSignals {
  return buildSignalsFromRegexSpec(file, getRegexSignalSpec(file));
}
