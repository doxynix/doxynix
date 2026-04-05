import path from "node:path";
import { DirectedGraph } from "graphology";
import * as languages from "linguist-languages";
import ts from "typescript";

import { dumpDebug } from "@/server/utils/debug-logger";

import { normalizeRepoPath } from "./common";

export type AliasRule = {
  prefix: string;
  targets: string[];
};

export function isLikelyInternalImportSpecifier(spec: string): boolean {
  const t = spec.trim();
  if (t.startsWith(".")) return true;
  if (t.startsWith("@/") || t.startsWith("~/") || t.startsWith("~~/")) return true;
  if (t.startsWith("#")) return true;
  return false;
}

const ALL_LINGUIST_EXTENSIONS = Array.from(
  new Set(
    Object.values(languages).flatMap((lang) => {
      const l = lang as { extensions?: readonly string[] };
      return l.extensions || [];
    })
  )
);

const RELATIVE_IMPORT_SUFFIXES = [
  "",
  ...ALL_LINGUIST_EXTENSIONS,
  "/index.ts",
  "/index.js",
  "/__init__.py",
];

export function resolveRelativeImport(fromPath: string, importPath: string, fileSet: Set<string>) {
  const normalizedImport = importPath.replaceAll("\\", "/");
  if (!normalizedImport.startsWith(".")) return null;

  const basePath = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromPath), normalizedImport)
  );
  for (const suffix of RELATIVE_IMPORT_SUFFIXES) {
    const candidate = normalizeRepoPath(`${basePath}${suffix}`);
    if (fileSet.has(candidate)) return candidate;
  }

  return null;
}

function resolveAliasImport(importPath: string, fileSet: Set<string>, aliasRules: AliasRule[]) {
  if (aliasRules.length === 0) return null;

  for (const rule of aliasRules) {
    if (!importPath.startsWith(rule.prefix)) continue;
    const suffix = importPath.slice(rule.prefix.length).replace(/^\/+/u, "");
    for (const target of rule.targets) {
      const candidateBase = normalizeRepoPath(path.posix.join(target, suffix));
      for (const importSuffix of RELATIVE_IMPORT_SUFFIXES) {
        const candidate = normalizeRepoPath(`${candidateBase}${importSuffix}`);
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
) {
  const aliasResolved = resolveAliasImport(importPath, fileSet, aliasRules);
  if (aliasResolved != null) return aliasResolved;

  const normalizedImport = importPath.replaceAll("\\", "/").replaceAll(".", "/");
  const candidates = [
    normalizedImport,
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
  ].map(normalizeRepoPath);

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }

  const lastSegment = normalizedImport.split("/").filter(Boolean).at(-1);
  if (lastSegment == null) return null;

  const fileNameCandidates = [
    lastSegment,
    `${lastSegment}.py`,
    `${lastSegment}.go`,
    `${lastSegment}.java`,
    `${lastSegment}.kt`,
    `${lastSegment}.cs`,
    `${lastSegment}.php`,
    `${lastSegment}.rb`,
    `${lastSegment}.rs`,
    `${lastSegment}.bsl`,
    `${lastSegment}.ts`,
    `${lastSegment}.js`,
  ];

  for (const fileName of fileNameCandidates) {
    const matches = filesByBaseName.get(fileName.toLowerCase());
    if (matches != null && matches.length === 1) return matches[0]!;
  }

  return null;
}

export function collectAliasRules(files: Array<{ content: string; path: string }>) {
  const rules: AliasRule[] = [];

  for (const file of files) {
    const normalizedPath = normalizeRepoPath(file.path);
    if (!/\/tsconfig(?:\.[^/]+)?\.json$/iu.test(normalizedPath)) continue;

    try {
      const parsed = ts.parseConfigFileTextToJson(normalizedPath, file.content);
      const compilerOptions = parsed.config?.compilerOptions;
      if (compilerOptions == null || typeof compilerOptions !== "object") continue;

      const baseUrl = typeof compilerOptions.baseUrl === "string" ? compilerOptions.baseUrl : ".";
      const paths = compilerOptions.paths as Record<string, string[] | undefined> | undefined;
      if (paths == null) continue;

      for (const [rawAlias, rawTargets] of Object.entries(paths)) {
        if (!Array.isArray(rawTargets) || rawTargets.length === 0) continue;
        const prefix = rawAlias.replace(/\*.*$/u, "");
        const targets = rawTargets.map((target) =>
          normalizeRepoPath(
            path.posix.join(
              path.posix.dirname(normalizedPath),
              baseUrl,
              target.replace(/\*.*$/u, "")
            )
          )
        );
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

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const stack: string[] = [];

  function detect(node: string) {
    visited.add(node);
    onStack.add(node);
    stack.push(node);

    graph.forEachOutNeighbor(node, (neighbor) => {
      if (cycles.length >= 8) return;

      if (onStack.has(neighbor)) {
        const cycleStart = stack.indexOf(neighbor);
        const cycle = stack.slice(cycleStart);
        cycles.push(cycle);
      } else if (!visited.has(neighbor)) {
        detect(neighbor);
      }
    });

    stack.pop();
    onStack.delete(node);
  }

  graph.forEachNode((node) => {
    if (cycles.length < 8 && !visited.has(node)) {
      detect(node);
    }
  });
  const result = [...cycles].sort((left, right) => left.length - right.length);
  dumpDebug("dependency-cycles", { count: result.length, cycles: result });
  return result;
}
