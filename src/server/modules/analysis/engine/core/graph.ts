import { analyzeGraph, type Edge } from "graph-cycles";
import { DirectedGraph } from "graphology";
import { hasCycle } from "graphology-dag";
import { basename, dirname, join, normalize } from "pathe";
import ts from "typescript";

import { dumpDebug } from "@/server/utils/debug-logger";
import { getKnownLanguageExtensions } from "@/server/utils/language-metadata";

import { SCHEMA_LIMITS } from "./scoring-constants";

type AliasRule = {
  prefix: string;
  targets: string[];
};

export function isLikelyInternalImportSpecifier(spec: string): boolean {
  const t = spec.trim();
  if (t.startsWith(".")) return true;
  if (/^[@~]{1,2}\//u.test(t)) return true;
  if (t.startsWith("#")) return true;
  return false;
}

const RELATIVE_IMPORT_SUFFIXES = [
  "",
  ...getKnownLanguageExtensions(),
  "/index.ts",
  "/index.js",
  "/__init__.py",
];

export function resolveRelativeImport(
  fromPath: string,
  importPath: string,
  fileSet: Set<string>
): null | string {
  const normalizedImport = normalize(importPath);
  if (!normalizedImport.startsWith(".")) return null;

  const basePath = normalize(join(dirname(fromPath), normalizedImport));

  for (const suffix of RELATIVE_IMPORT_SUFFIXES) {
    const candidate = `${basePath}${suffix}`;
    if (fileSet.has(candidate)) return candidate;
  }

  return null;
}

function resolveAliasImport(
  importPath: string,
  fileSet: Set<string>,
  aliasRules: AliasRule[]
): null | string {
  if (aliasRules.length === 0) return null;

  for (const rule of aliasRules) {
    if (!importPath.startsWith(rule.prefix)) continue;
    const suffix = importPath.slice(rule.prefix.length).replace(/^\/+/u, "");

    for (const target of rule.targets) {
      const candidateBase = normalize(join(target, suffix));
      for (const importSuffix of RELATIVE_IMPORT_SUFFIXES) {
        const candidate = `${candidateBase}${importSuffix}`;
        if (fileSet.has(candidate)) return candidate;
      }
    }
  }

  return null;
}

export function resolveModuleImport(
  importPath: string,
  fileSet: Set<string>,
  filesByBaseName: Map<string, string[]>,
  aliasRules: AliasRule[] = []
): null | string {
  const aliasResolved = resolveAliasImport(importPath, fileSet, aliasRules);
  if (aliasResolved != null) return aliasResolved;

  const normalizedImport = normalize(importPath);

  const candidates = [
    normalizedImport,
    `${normalizedImport}.ts`,
    `${normalizedImport}.js`,
    `${normalizedImport}.py`,
    `${normalizedImport}.go`,
    `${normalizedImport}.java`,
    `${normalizedImport}.kt`,
    `${normalizedImport}.cs`,
    `${normalizedImport}.php`,
    `${normalizedImport}.rb`,
    `${normalizedImport}.rs`,
    `${normalizedImport}.bsl`,
    `${normalizedImport}/__init__.py`,
    `${normalizedImport}/index.ts`,
    `${normalizedImport}/index.js`,
  ].map((path) => normalize(path));

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }

  const lastSegment = basename(normalizedImport);

  const fileNameCandidates = [
    lastSegment,
    `${lastSegment}.ts`,
    `${lastSegment}.js`,
    `${lastSegment}.py`,
    `${lastSegment}.go`,
    `${lastSegment}.java`,
    `${lastSegment}.kt`,
    `${lastSegment}.cs`,
    `${lastSegment}.php`,
    `${lastSegment}.rb`,
    `${lastSegment}.rs`,
    `${lastSegment}.bsl`,
  ];

  for (const fileName of fileNameCandidates) {
    const matches = filesByBaseName.get(fileName.toLowerCase());
    if (matches != null && matches.length > 0) {
      if (matches.length === 1) return matches[0]!;
      const tsMatch = matches.find((m) => m.endsWith(".ts"));
      if (tsMatch != null) return tsMatch;
      return matches[0]!;
    }
  }

  return null;
}

export function collectAliasRules(files: Array<{ content: string; path: string }>): AliasRule[] {
  const rules: AliasRule[] = [];

  for (const file of files) {
    const normalizedPath = normalize(file.path);
    if (!/\/tsconfig(?:\.[^/]+)?\.json$/iu.test(normalizedPath)) continue;

    try {
      const parsed = ts.parseConfigFileTextToJson(normalizedPath, file.content);
      if (parsed.error != null) continue;

      const compilerOptions = parsed.config?.compilerOptions;
      if (compilerOptions == null || typeof compilerOptions !== "object") continue;

      const baseUrl = typeof compilerOptions.baseUrl === "string" ? compilerOptions.baseUrl : ".";
      const paths = compilerOptions.paths as Record<string, string[] | undefined> | undefined;
      if (paths == null) continue;

      for (const [rawAlias, rawTargets] of Object.entries(paths)) {
        if (!Array.isArray(rawTargets) || rawTargets.length === 0) continue;

        const starIndex = rawAlias.indexOf("*");
        const prefix = starIndex === -1 ? rawAlias : rawAlias.slice(0, starIndex);

        const targets = rawTargets.map((target) => {
          const targetStarIndex = target.indexOf("*");
          const cleanTarget = targetStarIndex === -1 ? target : target.slice(0, targetStarIndex);
          return normalize(join(dirname(normalizedPath), baseUrl, cleanTarget));
        });

        rules.push({ prefix, targets });
      }
    } catch {
      // Best-effort helper only.
    }
  }

  return rules;
}

export function findDependencyCycles(graphMap: Map<string, Set<string>>): string[][] {
  const graph = new DirectedGraph();

  for (const [node, edges] of graphMap.entries()) {
    if (!graph.hasNode(node)) graph.addNode(node);
    for (const edge of edges) {
      if (!graph.hasNode(edge)) graph.addNode(edge);
      if (!graph.hasEdge(node, edge)) graph.addEdge(node, edge);
    }
  }

  if (!hasCycle(graph)) {
    void dumpDebug("dependency-cycles", { count: 0, cycles: [] });
    return [];
  }

  const mutableGraphData: Array<Edge> = [];
  const allNodes = new Set<string>();

  for (const [node, edges] of graphMap.entries()) {
    allNodes.add(node);
    for (const edge of edges) {
      allNodes.add(edge);
    }
  }

  for (const node of allNodes) {
    const edges = graphMap.get(node);
    mutableGraphData.push([node, edges ? Array.from(edges) : []]);
  }

  const analysis = analyzeGraph(mutableGraphData);
  const detectedCycles: string[][] = analysis.cycles;

  const result = [...detectedCycles]
    .sort((left, right) => left.length - right.length)
    .slice(0, SCHEMA_LIMITS.maxCyclesDetected);

  void dumpDebug("dependency-cycles", { count: result.length, cycles: result });
  return result;
}
