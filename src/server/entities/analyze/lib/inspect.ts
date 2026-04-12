import { normalizeRepoPath as normalizePath } from "@/server/shared/engine/core/common";
import { unique } from "@/server/shared/lib/array-utils";

import {
  buildNeighborBucketsForEntry,
  buildNeighborPathsForEntry,
  buildRecommendedActions,
  buildReviewPriority,
  buildSuggestedPathsForEntry,
  type StructureInspectEntryLike as BaseStructureInspectEntryLike,
  type StructureInspectNodeLike as BaseStructureInspectNodeLike,
  type StructureInspectContextLike,
} from "./node-inspection";

type StructureInspectEntryLike = BaseStructureInspectEntryLike & {
  changeCoupling: Array<{ commits: number; fromPath: string; toPath: string }>;
  churnHotspots: Array<{ commitsInWindow: number; path: string }>;
  entrypointDetails: Array<{ path: string; reason?: string | null }>;
  factTitles: string[];
  frameworkNames: string[];
  graphUnresolvedSamples: Array<{ fromPath: string; specifier: string }>;
};

type StructureInspectNodeLike = BaseStructureInspectNodeLike & {
  kind: string;
  label: string;
  path: string;
  previewPaths: string[];
  stats: {
    apiCount: number;
    changeCouplingCount: number;
    churnCount: number;
    configCount: number;
    dependencyHotspotCount: number;
    entrypointCount: number;
    frameworkCount: number;
    graphWarningCount: number;
    hotspotCount: number;
    orphanCount: number;
    pathCount: number;
    riskCount: number;
  };
};

export function buildInspectPayload(params: {
  context?: StructureInspectContextLike;
  currentPath?: string;
  entry: StructureInspectEntryLike;
  incoming: string[];
  node: StructureInspectNodeLike;
  outgoing: string[];
  relatedChildPaths?: string[];
  semanticLabel: string;
  summarizeImportance: (input: {
    apiCount: number;
    changeCouplingCount: number;
    churnCount: number;
    configCount: number;
    dependencyHotspotCount: number;
    entrypointCount: number;
    frameworkCount: number;
    graphWarningCount: number;
    groupId: string;
    hotspotCount: number;
    orphanCount: number;
    primaryKind: string;
    riskCount: number;
    sampleCount: number;
  }) => string;
}) {
  const frameworkHints = unique(params.entry.frameworkNames).slice(0, 5);
  const hotspotHints = unique([
    ...params.entry.hotspotSignals
      .toSorted((left, right) => right.score - left.score)
      .slice(0, 2)
      .map(
        (signal) =>
          `${signal.path} looks hotspot-prone (score ${signal.score}, complexity ${signal.complexity}, churn ${signal.churnScore}).`
      ),
    ...params.entry.dependencyHotspots
      .slice(0, 2)
      .map(
        (hotspot) =>
          `${hotspot.path} is dependency-central (inbound ${hotspot.inbound}, outbound ${hotspot.outbound}, exports ${hotspot.exports}).`
      ),
  ]).slice(0, 4);
  const graphHints = unique([
    ...(params.entry.graphNeighborPaths.length > 0
      ? [`Graph-connected neighbors: ${params.entry.graphNeighborPaths.slice(0, 4).join(", ")}.`]
      : []),
    ...(params.entry.orphanPaths.length > 0
      ? [`Possibly isolated runtime paths: ${params.entry.orphanPaths.slice(0, 3).join(", ")}.`]
      : []),
    ...(params.entry.graphUnresolvedSamples.length > 0
      ? [
          `Dependency resolution is partial here: ${params.entry.graphUnresolvedSamples
            .slice(0, 2)
            .map((sample) => {
              const typedSample = sample as { fromPath: string; specifier: string };
              return `${typedSample.fromPath} -> ${typedSample.specifier}`;
            })
            .join("; ")}.`,
        ]
      : []),
  ]).slice(0, 3);
  const relatedPaths = unique([
    ...params.entry.entrypointDetails.map((item) => normalizePath(item.path)),
    ...params.entry.apiPaths,
    ...params.entry.publicSurfacePaths,
    ...params.entry.hotspotSignals.map((item) => normalizePath(item.path)),
    ...params.entry.dependencyHotspots.map((item) => normalizePath(item.path)),
    ...params.entry.graphNeighborPaths,
    ...params.entry.orphanPaths,
    ...params.entry.configPaths,
    ...params.entry.changeCoupling.flatMap((item) => [
      normalizePath(item.fromPath),
      normalizePath(item.toPath),
    ]),
  ]).slice(0, 8);
  const gitHints = unique([
    ...params.entry.churnHotspots
      .slice(0, 2)
      .map(
        (hotspot) =>
          `${hotspot.path} changed frequently in recent history (${(hotspot as unknown as { commitsInWindow: number }).commitsInWindow} commits in window).`
      ),
    ...params.entry.changeCoupling
      .slice(0, 2)
      .map(
        (pair) =>
          `${pair.fromPath} and ${pair.toPath} often change together (${(pair as unknown as { commits: number }).commits} coupled commits).`
      ),
  ]).slice(0, 4);
  const nextSuggestedPaths =
    params.context == null
      ? []
      : buildSuggestedPathsForEntry({
          context: params.context,
          currentPath: params.currentPath ?? params.node.path,
          entry: params.entry,
          relatedChildPaths: params.relatedChildPaths ?? [],
        });
  const neighborPaths = buildNeighborPathsForEntry({
    currentPath: params.currentPath ?? params.node.path,
    entry: params.entry,
    relatedChildPaths: params.relatedChildPaths ?? [],
  });
  const neighborBuckets = buildNeighborBucketsForEntry({
    currentPath: params.currentPath ?? params.node.path,
    entry: params.entry,
    relatedChildPaths: params.relatedChildPaths ?? [],
  });
  const reviewPriority = buildReviewPriority({
    entry: params.entry,
    node: params.node,
  });

  return {
    apiHints:
      params.node.stats.apiCount === 0
        ? []
        : [
            `API-facing paths in this area: ${params.node.stats.apiCount}.`,
            ...(params.entry.publicSurfacePaths.length > 0
              ? [
                  `Public surface paths: ${unique(params.entry.publicSurfacePaths).slice(0, 3).join(", ")}.`,
                ]
              : []),
            ...(params.entry.graphNeighborPaths.length > 0
              ? [`Graph neighbors: ${params.entry.graphNeighborPaths.slice(0, 3).join(", ")}.`]
              : []),
          ],
    configHints: unique(params.entry.configPaths).slice(0, 5),
    dependsOn: unique(params.outgoing),
    entrypointReason: params.entry.entrypointDetails[0]?.reason ?? null,
    factTitles: unique(params.entry.factTitles).slice(0, 5),
    frameworkHints,
    gitHints,
    graphHints,
    hotspotHints,
    kind: params.semanticLabel,
    neighborBuckets,
    neighborPaths,
    nextSuggestedPaths,
    recommendedActions: buildRecommendedActions({
      entry: params.entry,
      node: params.node,
    }),
    relatedPaths,
    reviewPriority,
    samplePaths: params.node.previewPaths,
    title: params.node.label,
    usedBy: unique(params.incoming),
    whyImportant: params.summarizeImportance({
      apiCount: params.node.stats.apiCount,
      changeCouplingCount: params.node.stats.changeCouplingCount,
      churnCount: params.node.stats.churnCount,
      configCount: params.node.stats.configCount,
      dependencyHotspotCount: params.node.stats.dependencyHotspotCount,
      entrypointCount: params.node.stats.entrypointCount,
      frameworkCount: params.node.stats.frameworkCount,
      graphWarningCount: params.node.stats.graphWarningCount,
      groupId: params.node.path,
      hotspotCount: params.node.stats.hotspotCount,
      orphanCount: params.node.stats.orphanCount,
      primaryKind: params.node.kind,
      riskCount: params.node.stats.riskCount,
      sampleCount: params.node.stats.pathCount,
    }),
  };
}
