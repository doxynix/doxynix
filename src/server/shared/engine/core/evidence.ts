import type { DependencyNodeMetric } from "@/server/shared/types";

import { normalizeRepoPath } from "./common";
import { FileClassifier } from "./file-classifier";
import { selectRepositoryFrameworkFacts } from "./framework-catalog";
import {
  collectAliasRules,
  findDependencyCycles,
  isLikelyInternalImportSpecifier,
  resolveModuleImport,
  resolveRelativeImport,
} from "./graph";
import type {
  ConfigRef,
  DependencyEdge,
  EntrypointKind,
  EntrypointRef,
  FileCategoryBreakdownItem,
  FileComplexity,
  FileSignals,
  ModuleRef,
  RepositoryEvidence,
  RepositoryFile,
  RouteInventory,
  RouteRef,
  SymbolRef,
} from "./types";

type NormalizedRepositoryFile = RepositoryFile & { path: string };

type EvidenceLookups = {
  aliasRules: ReturnType<typeof collectAliasRules>;
  complexityByFile: Map<string, number>;
  filesByBaseName: Map<string, string[]>;
  fileSet: Set<string>;
  normalizedFiles: NormalizedRepositoryFile[];
};

type DependencyTracking = {
  edges: DependencyEdge[];
  graph: Map<string, Set<string>>;
  inboundByFile: Map<string, number>;
  resolvedEdges: number;
  unresolvedImportSpecifiers: number;
  unresolvedSamples: Array<{ fromPath: string; specifier: string }>;
};

type EvidenceAssembly = {
  apiSurfaceByFile: Map<string, number>;
  configs: ConfigRef[];
  dependencyTracking: DependencyTracking;
  exportsByFile: Map<string, number>;
  modules: ModuleRef[];
  routes: RouteRef[];
  symbols: SymbolRef[];
};

type CollectedFileEvidence = {
  apiSurface: number;
  configs: ConfigRef[];
  entrypointHints: EntrypointRef[];
  exports: number;
  imports: string[];
  routes: RouteRef[];
  signals: FileSignals;
  symbols: SymbolRef[];
};

function dedupeEntrypoints(entrypoints: EntrypointRef[]) {
  const seen = new Map<string, EntrypointRef>();

  for (const entrypoint of entrypoints) {
    const key = `${entrypoint.kind}:${entrypoint.path}`;
    const existing = seen.get(key);
    if (existing == null || existing.confidence < entrypoint.confidence) {
      seen.set(key, entrypoint);
    }
  }

  return Array.from(seen.values()).sort(
    (left, right) => right.confidence - left.confidence || left.path.localeCompare(right.path)
  );
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

function buildEvidenceLookups(
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

function buildRouteInventory(
  evidence: Pick<RepositoryEvidence, "frameworkFacts" | "routes">
): RouteInventory {
  const primaryRoutes = evidence.routes.filter((route) =>
    FileClassifier.isPrimaryApiEvidenceFile(route.sourcePath)
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

function createDependencyTracking(): DependencyTracking {
  return {
    edges: [],
    graph: new Map<string, Set<string>>(),
    inboundByFile: new Map<string, number>(),
    resolvedEdges: 0,
    unresolvedImportSpecifiers: 0,
    unresolvedSamples: [],
  };
}

function createEvidenceAssembly(): EvidenceAssembly {
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

function kindForFile(path: string, categories: string[]): EntrypointKind {
  if (categories.includes("benchmark")) return "benchmark";
  if (categories.includes("test")) return "test";
  if (categories.includes("infra")) return "infra";
  if (categories.includes("tooling") || /^scripts\//iu.test(path) || /^cli\//iu.test(path)) {
    return "tooling";
  }
  if (/\/index\.[cm]?[jt]sx?$/iu.test(path)) return "library";
  return "runtime";
}

function inferEntrypoints(params: {
  apiSurfaceByFile: Map<string, number>;
  exportsByFile: Map<string, number>;
  inboundByFile: Map<string, number>;
  moduleByPath: Map<string, RepositoryEvidence["modules"][number]>;
}) {
  const entrypoints: EntrypointRef[] = [];

  const normalizeHint = (
    hint: EntrypointRef,
    filePath: string,
    categories: string[]
  ): EntrypointRef => {
    if (hint.kind === "library" || hint.kind === "runtime") {
      if (FileClassifier.isPrimaryEntrypointFile(hint.path)) {
        return hint;
      }

      return {
        ...hint,
        kind: kindForFile(filePath, categories),
        reason: `${hint.reason}; downgraded because the file sits outside the primary runtime contour`,
      };
    }

    return hint;
  };

  for (const [filePath, module] of params.moduleByPath.entries()) {
    const inbound = params.inboundByFile.get(filePath) ?? 0;
    const apiSurface = params.apiSurfaceByFile.get(filePath) ?? 0;
    const exports = params.exportsByFile.get(filePath) ?? 0;
    const categories = module.categories;
    const primaryKind = kindForFile(filePath, categories);

    entrypoints.push(
      ...module.entrypointHints.map((hint) => normalizeHint(hint, filePath, categories))
    );

    if (
      primaryKind === "runtime" &&
      inbound === 0 &&
      (apiSurface > 0 || module.entrypointHints.length > 0) &&
      FileClassifier.isPrimaryEntrypointFile(filePath)
    ) {
      entrypoints.push({
        confidence: apiSurface > 0 ? 86 : 74,
        kind: "runtime",
        path: filePath,
        reason:
          apiSurface > 0
            ? "top-level API surface with no inbound dependencies"
            : "runtime source with bootstrap hints",
      });
    }

    if (
      FileClassifier.isPrimaryEntrypointFile(filePath) &&
      FileClassifier.isArchitectureRelevant(filePath) &&
      inbound === 0 &&
      exports > 0 &&
      /\/index\.[cm]?[jt]sx?$/iu.test(filePath)
    ) {
      entrypoints.push({
        confidence: 72,
        kind: "library",
        path: filePath,
        reason: "export-heavy index file with no inbound references suggests public surface",
      });
    }

    if (
      (primaryKind === "tooling" ||
        primaryKind === "benchmark" ||
        primaryKind === "test" ||
        primaryKind === "infra") &&
      inbound === 0
    ) {
      entrypoints.push({
        confidence: 58,
        kind: primaryKind,
        path: filePath,
        reason: "isolated non-runtime file kept as secondary entrypoint evidence",
      });
    }
  }

  return dedupeEntrypoints(entrypoints);
}

function resolveImportEdges(
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

    if (resolved === filePath) {
      continue;
    }

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

async function collectFileEvidence(
  file: NormalizedRepositoryFile,
  lookups: Pick<EvidenceLookups, "aliasRules" | "fileSet" | "filesByBaseName">,
  tracking: DependencyTracking,
  fileSignalsByPath: Map<string, FileSignals>
): Promise<CollectedFileEvidence> {
  const signals =
    fileSignalsByPath.get(file.path) ?? fileSignalsByPath.get(normalizeRepoPath(file.path));
  if (signals == null) {
    throw new Error(`Missing pre-collected FileSignals for ${file.path}`);
  }
  resolveImportEdges(file.path, signals.imports, lookups, tracking);

  return {
    apiSurface: signals.apiSurface,
    configs: [
      ...(FileClassifier.isConfigFile(file.path)
        ? [
            {
              confidence: 90,
              kind: file.path.split("/").at(-1) ?? "config",
              path: file.path,
            } satisfies ConfigRef,
          ]
        : []),
      ...(signals.configRefs ?? []),
    ],
    entrypointHints: [...(signals.entrypointRefs ?? [])],
    exports: signals.exports,
    imports: signals.imports,
    routes: signals.routes ?? [],
    signals,
    symbols: signals.symbols ?? [],
  };
}

function buildModuleRef(
  filePath: string,
  signals: FileSignals,
  entrypointHints: EntrypointRef[]
): ModuleRef {
  return {
    apiSurface: signals.apiSurface,
    categories: signals.categories ?? FileClassifier.getCategories(filePath),
    entrypointHints,
    exports: signals.exports,
    frameworkHints: signals.frameworkHints ?? [],
    imports: signals.imports,
    parseTier: signals.analysisMode,
    path: filePath,
    routeCount: (signals.routes ?? []).length,
    symbols: signals.symbols ?? [],
  };
}

function buildMainEntrypointPaths(entrypoints: EntrypointRef[]) {
  return new Set(
    entrypoints
      .filter((entrypoint) => entrypoint.kind === "runtime" || entrypoint.kind === "library")
      .filter((entrypoint) => FileClassifier.isPrimaryEntrypointFile(entrypoint.path))
      .map((entrypoint) => entrypoint.path)
  );
}

function buildOrphanModules(
  modules: ModuleRef[],
  inboundByFile: Map<string, number>,
  mainEntrypointPaths: Set<string>
) {
  return modules
    .filter((module) => {
      if (!FileClassifier.isArchitectureRelevant(module.path)) return false;
      if (mainEntrypointPaths.has(module.path)) return false;
      return (inboundByFile.get(module.path) ?? 0) === 0;
    })
    .map((module) => module.path);
}

function buildDependencyHotspots(
  modules: ModuleRef[],
  exportsByFile: Map<string, number>,
  inboundByFile: Map<string, number>,
  graph: Map<string, Set<string>>
) {
  return modules
    .filter((module) => FileClassifier.isArchitectureRelevant(module.path))
    .map<DependencyNodeMetric>((module) => ({
      exports: exportsByFile.get(module.path) ?? 0,
      inbound: inboundByFile.get(module.path) ?? 0,
      outbound: graph.get(module.path)?.size ?? 0,
      path: module.path,
    }))
    .sort((left, right) => {
      const leftScore = left.inbound * 3 + left.outbound + left.exports;
      const rightScore = right.inbound * 3 + right.outbound + right.exports;
      return rightScore - leftScore;
    });
}

function buildHotspotSignals(
  modules: ModuleRef[],
  complexityByFile: Map<string, number>,
  inboundByFile: Map<string, number>,
  graph: Map<string, Set<string>>
) {
  return modules
    .filter((module) => FileClassifier.isArchitectureRelevant(module.path))
    .map((module) => {
      const inbound = inboundByFile.get(module.path) ?? 0;
      const outbound = graph.get(module.path)?.size ?? 0;
      const complexity = complexityByFile.get(module.path) ?? 0;
      const score =
        complexity * 1.15 +
        inbound * 14 +
        outbound * 3 +
        module.apiSurface * 4 +
        module.exports * 2;

      return {
        categories: module.categories,
        churnScore: 0,
        complexity,
        inbound,
        outbound,
        path: module.path,
        score: Math.round(score),
      };
    })
    .sort((left, right) => right.score - left.score);
}

function buildFileCategoryBreakdown(modules: ModuleRef[]): FileCategoryBreakdownItem[] {
  return Array.from(
    modules.reduce((acc, module) => {
      for (const category of module.categories) {
        acc.set(category, (acc.get(category) ?? 0) + 1);
      }
      return acc;
    }, new Map<string, number>())
  )
    .map(([category, count]) => ({
      category: category as FileCategoryBreakdownItem["category"],
      count,
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

function dedupeConfigs(configs: ConfigRef[]) {
  return configs
    .filter(
      (config, index, all) =>
        all.findIndex(
          (candidate) => candidate.path === config.path && candidate.kind === config.kind
        ) === index
    )
    .sort((left, right) => left.path.localeCompare(right.path));
}

// Source-of-truth builder for repository structure: modules, graph, entrypoints, routes, configs, and hotspots.
export async function collectRepositoryEvidence(
  files: RepositoryFile[],
  fileComplexities: FileComplexity[],
  fileSignalsByPath: Map<string, FileSignals>
) {
  const lookups = buildEvidenceLookups(files, fileComplexities);
  const assembly = createEvidenceAssembly();

  for (const file of lookups.normalizedFiles) {
    const collected = await collectFileEvidence(
      file,
      lookups,
      assembly.dependencyTracking,
      fileSignalsByPath
    );

    assembly.apiSurfaceByFile.set(file.path, collected.apiSurface);
    assembly.exportsByFile.set(file.path, collected.exports);
    assembly.configs.push(...collected.configs);
    assembly.routes.push(...collected.routes);
    assembly.symbols.push(...collected.symbols);
    assembly.modules.push(buildModuleRef(file.path, collected.signals, collected.entrypointHints));
  }

  const moduleByPath = new Map(assembly.modules.map((module) => [module.path, module] as const));
  const entrypoints = inferEntrypoints({
    apiSurfaceByFile: assembly.apiSurfaceByFile,
    exportsByFile: assembly.exportsByFile,
    inboundByFile: assembly.dependencyTracking.inboundByFile,
    moduleByPath,
  });
  const mainEntrypointPaths = buildMainEntrypointPaths(entrypoints);

  const orphanModules = buildOrphanModules(
    assembly.modules,
    assembly.dependencyTracking.inboundByFile,
    mainEntrypointPaths
  );
  const dependencyCycles = findDependencyCycles(assembly.dependencyTracking.graph);
  const dependencyHotspots = buildDependencyHotspots(
    assembly.modules,
    assembly.exportsByFile,
    assembly.dependencyTracking.inboundByFile,
    assembly.dependencyTracking.graph
  );
  const hotspotSignals = buildHotspotSignals(
    assembly.modules,
    lookups.complexityByFile,
    assembly.dependencyTracking.inboundByFile,
    assembly.dependencyTracking.graph
  );
  const frameworkFacts = selectRepositoryFrameworkFacts(
    assembly.modules.flatMap((module) => module.frameworkHints)
  );
  const publicSurface = assembly.symbols.filter(
    (symbol) => symbol.exported && FileClassifier.isArchitectureRelevant(symbol.path)
  );
  const fileCategoryBreakdown = buildFileCategoryBreakdown(assembly.modules);

  const evidence: RepositoryEvidence = {
    configs: dedupeConfigs(assembly.configs),
    dependencyCycles,
    dependencyGraph: {
      edges: assembly.dependencyTracking.edges,
      resolvedEdges: assembly.dependencyTracking.resolvedEdges,
      unresolvedImportSpecifiers: assembly.dependencyTracking.unresolvedImportSpecifiers,
      unresolvedSamples: assembly.dependencyTracking.unresolvedSamples,
    },
    entrypoints,
    fileCategoryBreakdown,
    frameworkFacts,
    hotspotSignals,
    modules: assembly.modules,
    orphanModules,
    publicSurface,
    routeInventory: buildRouteInventory({ frameworkFacts, routes: assembly.routes }),
    routes: assembly.routes,
    symbols: assembly.symbols,
  };

  return { dependencyHotspots, evidence };
}
