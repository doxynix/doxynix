import { normalizeRepoPath } from "./common";
import type {
  ConfigRef,
  DependencyEdge,
  FileComplexity,
  FileSignals,
  ModuleRef,
  RepositoryEvidence,
  RepositoryFile,
  RouteInventory,
  RouteRef,
  SymbolRef,
} from "./discovery.types";
import {
  collectAliasRules,
  findDependencyCycles,
  isLikelyInternalImportSpecifier,
  resolveModuleImport,
  resolveRelativeImport,
} from "./graph";
import { ProjectPolicy } from "./project-policy";

export type NormalizedRepositoryFile = RepositoryFile & { path: string };

export type EvidenceLookups = {
  aliasRules: ReturnType<typeof collectAliasRules>;
  complexityByFile: Map<string, number>;
  filesByBaseName: Map<string, string[]>;
  fileSet: Set<string>;
  normalizedFiles: NormalizedRepositoryFile[];
};

export type DependencyTracking = {
  edges: DependencyEdge[];
  graph: Map<string, Set<string>>;
  inboundByFile: Map<string, number>;
  resolvedEdges: number;
  unresolvedImportSpecifiers: number;
  unresolvedSamples: Array<{ fromPath: string; specifier: string }>;
};

export type EvidenceAssembly = {
  apiSurfaceByFile: Map<string, number>;
  configs: ConfigRef[];
  dependencyTracking: DependencyTracking;
  exportsByFile: Map<string, number>;
  modules: ModuleRef[];
  routes: RouteRef[];
  symbols: SymbolRef[];
};

export type CollectedFileEvidence = {
  apiSurface: number;
  configs: ConfigRef[];
  entrypointHints: ModuleRef["entrypointHints"];
  exports: number;
  imports: string[];
  routes: RouteRef[];
  signals: FileSignals;
  symbols: SymbolRef[];
};

export function buildRouteInventory(
  evidence: Pick<RepositoryEvidence, "frameworkFacts" | "routes">
): RouteInventory {
  const primaryRoutes = evidence.routes.filter((route) =>
    ProjectPolicy.isPrimaryApiSurface(route.sourcePath)
  );
  const rpcProcedures = primaryRoutes.filter((route) => route.kind === "rpc").length;
  const httpRoutes = primaryRoutes
    .filter((route) => route.kind === "http" && route.method != null)
    .map((route) => ({
      method: route.method ?? "GET",
      path: route.path,
      sourcePath: route.sourcePath,
    }));

  return {
    estimatedOperations: httpRoutes.length + rpcProcedures,
    frameworks: evidence.frameworkFacts.map((fact) => fact.name),
    httpRoutes,
    rpcProcedures,
    source: "extracted",
    sourceFiles: Array.from(new Set(primaryRoutes.map((route) => route.sourcePath))).sort(
      (left, right) => left.localeCompare(right)
    ),
  };
}

function normalizeFiles(files: RepositoryFile[]): NormalizedRepositoryFile[] {
  return files.map((file) => ({
    ...file,
    path: normalizeRepoPath(file.path),
  }));
}

function buildFilesByBaseName(files: NormalizedRepositoryFile[]) {
  const filesByBaseName = new Map<string, string[]>();

  for (const file of files) {
    const baseName = file.path.split("/").at(-1)?.toLowerCase();
    if (baseName == null) continue;
    const bucket = filesByBaseName.get(baseName);
    if (bucket == null) {
      filesByBaseName.set(baseName, [file.path]);
    } else {
      bucket.push(file.path);
    }
  }

  return filesByBaseName;
}

export function buildEvidenceLookups(
  files: RepositoryFile[],
  fileComplexities: FileComplexity[]
): EvidenceLookups {
  const normalizedFiles = normalizeFiles(files);

  return {
    aliasRules: collectAliasRules(normalizedFiles),
    complexityByFile: new Map(
      fileComplexities.map((item) => [normalizeRepoPath(item.path), item.score] as const)
    ),
    filesByBaseName: buildFilesByBaseName(normalizedFiles),
    fileSet: new Set(normalizedFiles.map((file) => file.path)),
    normalizedFiles,
  };
}

export function createDependencyTracking(): DependencyTracking {
  return {
    edges: [],
    graph: new Map<string, Set<string>>(),
    inboundByFile: new Map<string, number>(),
    resolvedEdges: 0,
    unresolvedImportSpecifiers: 0,
    unresolvedSamples: [],
  };
}

export function createEvidenceAssembly(): EvidenceAssembly {
  return {
    apiSurfaceByFile: new Map<string, number>(),
    configs: [],
    dependencyTracking: createDependencyTracking(),
    exportsByFile: new Map<string, number>(),
    modules: [],
    routes: [],
    symbols: [],
  };
}

export function resolveImportEdges(
  filePath: string,
  imports: string[],
  lookups: Pick<EvidenceLookups, "aliasRules" | "fileSet" | "filesByBaseName">,
  tracking: DependencyTracking
) {
  const resolvedImports: string[] = [];

  for (const importPath of imports) {
    const resolved =
      resolveRelativeImport(filePath, importPath, lookups.fileSet) ??
      resolveModuleImport(importPath, lookups.fileSet, lookups.filesByBaseName, lookups.aliasRules);

    if (resolved === filePath) continue;

    if (resolved != null) {
      resolvedImports.push(resolved);
      tracking.resolvedEdges += 1;
      tracking.edges.push({
        fromPath: filePath,
        kind: "internal",
        resolved: true,
        specifier: importPath,
        toPath: resolved,
      });
      tracking.inboundByFile.set(resolved, (tracking.inboundByFile.get(resolved) ?? 0) + 1);
      continue;
    }

    const kind = isLikelyInternalImportSpecifier(importPath) ? "internal" : "external";
    tracking.edges.push({
      fromPath: filePath,
      kind,
      resolved: false,
      specifier: importPath,
    });

    if (kind === "internal") {
      tracking.unresolvedImportSpecifiers += 1;
      if (tracking.unresolvedSamples.length < 24) {
        tracking.unresolvedSamples.push({ fromPath: filePath, specifier: importPath });
      }
    }
  }

  tracking.graph.set(filePath, new Set(resolvedImports));
  return resolvedImports;
}

export { findDependencyCycles };
