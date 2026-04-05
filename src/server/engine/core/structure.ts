import type { DependencyNodeMetric } from "@/server/shared/types";
import { dumpDebug } from "@/server/utils/debug-logger";

import { clamp } from "./common";
import { collectRepositoryEvidence } from "./evidence";
import { FileClassifier } from "./file-classifier";
import type {
  FileComplexity,
  FileSignals,
  RepositoryEvidence,
  RepositoryFile,
  StructuralSignals,
} from "./types";

export function buildStructuralSignals(
  evidence: RepositoryEvidence,
  dependencyHotspots: DependencyNodeMetric[]
): StructuralSignals {
  return {
    apiSurface: evidence.modules.reduce((sum, module) => sum + module.apiSurface, 0),
    configInventory: evidence.configs
      .map((config) => config.path)
      .sort((left, right) => left.localeCompare(right)),
    dependencyCycles: evidence.dependencyCycles,
    dependencyHotspots,
    entrypointDetails: evidence.entrypoints,
    entrypoints: FileClassifier.filterPrimaryEntrypointPaths(
      evidence.entrypoints
        .filter((entrypoint) => entrypoint.kind === "runtime" || entrypoint.kind === "library")
        .map((entrypoint) => entrypoint.path)
    ),
    fileCategoryBreakdown: evidence.fileCategoryBreakdown,
    frameworkFacts: evidence.frameworkFacts,
    graphReliability: {
      resolvedEdges: evidence.dependencyGraph.resolvedEdges,
      unresolvedImportSpecifiers: evidence.dependencyGraph.unresolvedImportSpecifiers,
      unresolvedSamples: evidence.dependencyGraph.unresolvedSamples,
    },
    hotspotFiles: evidence.hotspotSignals.map((signal) => signal.path),
    hotspotSignals: evidence.hotspotSignals,
    orphanModules: evidence.orphanModules,
    publicExports: evidence.publicSurface.length,
    routeInventory: evidence.routeInventory,
  };
}

export async function collectStructuralSignals(
  files: RepositoryFile[],
  fileComplexities: FileComplexity[],
  fileSignalsByPath: Map<string, FileSignals>
): Promise<{ evidence: RepositoryEvidence; structuralSignals: StructuralSignals }> {
  const { dependencyHotspots, evidence } = await collectRepositoryEvidence(
    files,
    fileComplexities,
    fileSignalsByPath
  );

  const structuralResult = buildStructuralSignals(evidence, dependencyHotspots);

  dumpDebug("structural-signals", structuralResult);
  dumpDebug("repository-evidence", evidence);
  return { evidence, structuralSignals: structuralResult };
}

export function scoreStructuralModularity(params: {
  dependencyCycles: string[][];
  dependencyHotspots: DependencyNodeMetric[];
  orphanModules: string[];
}) {
  const cyclePenalty = Math.min(28, params.dependencyCycles.length * 9);
  const orphanPenalty = Math.min(22, params.orphanModules.length * 2);
  const avgInbound =
    params.dependencyHotspots.length === 0
      ? 0
      : params.dependencyHotspots.reduce((sum, item) => sum + item.inbound, 0) /
        params.dependencyHotspots.length;

  return clamp(Math.round(100 - cyclePenalty - orphanPenalty - avgInbound * 3), 0, 100);
}
