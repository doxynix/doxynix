import { dumpDebug } from "@/server/shared/lib/debug-logger";
import type { DependencyNodeMetric } from "@/server/shared/types";

import { clamp } from "./common";
import type {
  FileComplexity,
  FileSignals,
  GraphPreviewEdge,
  RepositoryEvidence,
  RepositoryFile,
  StructuralSignals,
} from "./discovery.types";
import { collectRepositoryEvidence } from "./evidence";
import { ProjectPolicy } from "./project-policy";
import { STRUCTURAL_MODULARITY_SCORING } from "./scoring-constants";

function buildGraphPreviewEdges(evidence: RepositoryEvidence, limit = 96): GraphPreviewEdge[] {
  const edgeMap = new Map<string, GraphPreviewEdge>();

  for (const edge of evidence.dependencyGraph.edges) {
    if (!edge.resolved || edge.kind !== "internal" || edge.toPath == null) continue;

    const fromPath = edge.fromPath;
    const toPath = edge.toPath;
    if (!ProjectPolicy.isGraphPreviewCandidate(fromPath)) continue;
    if (!ProjectPolicy.isGraphPreviewCandidate(toPath)) continue;

    const key = `${fromPath}=>${toPath}`;
    const current = edgeMap.get(key);
    if (current == null) {
      edgeMap.set(key, { fromPath, toPath, weight: 1 });
    } else {
      current.weight += 1;
    }
  }

  return Array.from(edgeMap.values())
    .sort(
      (left, right) =>
        right.weight - left.weight ||
        left.fromPath.localeCompare(right.fromPath) ||
        left.toPath.localeCompare(right.toPath)
    )
    .slice(0, limit);
}

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
    entrypoints: ProjectPolicy.filterPrimaryEntrypointPaths(
      evidence.entrypoints
        .filter((entrypoint) => entrypoint.kind === "runtime" || entrypoint.kind === "library")
        .map((entrypoint) => entrypoint.path)
    ),
    fileCategoryBreakdown: evidence.fileCategoryBreakdown,
    frameworkFacts: evidence.frameworkFacts,
    graphPreviewEdges: buildGraphPreviewEdges(evidence),
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
  const cyclePenalty = Math.min(
    STRUCTURAL_MODULARITY_SCORING.cyclePenaltyMax,
    params.dependencyCycles.length * STRUCTURAL_MODULARITY_SCORING.cycleMultiplier
  );
  const orphanPenalty = Math.min(
    STRUCTURAL_MODULARITY_SCORING.orphanPenaltyMax,
    params.orphanModules.length * STRUCTURAL_MODULARITY_SCORING.orphanMultiplier
  );
  const avgInbound =
    params.dependencyHotspots.length === 0
      ? 0
      : params.dependencyHotspots.reduce((sum, item) => sum + item.inbound, 0) /
        params.dependencyHotspots.length;

  const hotspotPenalty = clamp(avgInbound * 3, 0, STRUCTURAL_MODULARITY_SCORING.hotspotPenaltyMax);

  return clamp(Math.round(100 - cyclePenalty - orphanPenalty - hotspotPenalty), 0, 100);
}
