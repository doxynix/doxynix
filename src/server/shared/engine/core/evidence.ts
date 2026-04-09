import type {
  FileComplexity,
  FileSignals,
  RepositoryEvidence,
  RepositoryFile,
} from "./discovery.types";
import { buildModuleRef, collectFileEvidence } from "./evidence-collector";
import {
  buildDependencyHotspots,
  buildFileCategoryBreakdown,
  buildHotspotSignals,
  buildMainEntrypointPaths,
  buildOrphanModules,
  dedupeConfigs,
  inferEntrypoints,
} from "./evidence-derived";
import {
  buildEvidenceLookups,
  buildRouteInventory,
  createEvidenceAssembly,
  findDependencyCycles,
  resolveImportEdges,
} from "./evidence-support";
import { selectRepositoryFrameworkFacts } from "./framework-catalog";
import { ProjectPolicy } from "./project-policy";

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
      fileSignalsByPath,
      resolveImportEdges
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
    (symbol) => symbol.exported && ProjectPolicy.isArchitectureRelevant(symbol.path)
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
