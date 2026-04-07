import type { AIResult } from "@/server/features/analyze-repo/lib/schemas";
import type { RepoMetrics } from "@/server/features/analyze-repo/lib/types";
import { normalizeRepoPath as normalizePath } from "@/server/shared/engine/core/common";

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function collectScopedEntrySignals(
  paths: string[],
  context: {
    aiResult: AIResult;
    metrics: RepoMetrics;
  }
) {
  const normalizedPaths = unique(paths.map((path) => normalizePath(path)));
  const pathSet = new Set(normalizedPaths);

  const frameworkNames = unique(
    (context.metrics.frameworkFacts ?? [])
      .filter((fact) => fact.sources.some((source) => pathSet.has(normalizePath(source))))
      .map((fact) => fact.name)
  ).slice(0, 5);

  const hotspotSignals = [...(context.metrics.hotspotSignals ?? [])]
    .filter((signal) => pathSet.has(normalizePath(signal.path)))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const dependencyHotspots = [...context.metrics.dependencyHotspots]
    .filter((hotspot) => pathSet.has(normalizePath(hotspot.path)))
    .sort(
      (left, right) =>
        right.inbound +
        right.outbound +
        right.exports -
        (left.inbound + left.outbound + left.exports)
    )
    .slice(0, 4);

  const orphanPaths = unique(
    context.metrics.orphanModules
      .map((path) => normalizePath(path))
      .filter((path) => pathSet.has(path))
  ).slice(0, 4);

  const graphUnresolvedSamples = (context.metrics.graphReliability?.unresolvedSamples ?? [])
    .filter((sample) => pathSet.has(normalizePath(sample.fromPath)))
    .slice(0, 4);

  const graphNeighborPaths = unique(
    (context.metrics.graphPreviewEdges ?? [])
      .flatMap((edge) => {
        const fromPath = normalizePath(edge.fromPath);
        const toPath = normalizePath(edge.toPath);

        if (pathSet.has(fromPath) && !pathSet.has(toPath)) return [toPath];
        if (pathSet.has(toPath) && !pathSet.has(fromPath)) return [fromPath];
        return [];
      })
      .filter((path) => !pathSet.has(path))
  ).slice(0, 8);

  const factTitles = unique(
    (context.aiResult.repository_facts ?? [])
      .filter((fact) => fact.evidence.some((item) => pathSet.has(normalizePath(item.path))))
      .map((fact) => fact.title)
  ).slice(0, 5);

  return {
    changeCoupling: [...(context.metrics.changeCoupling ?? [])]
      .filter(
        (pair) =>
          pathSet.has(normalizePath(pair.fromPath)) || pathSet.has(normalizePath(pair.toPath))
      )
      .sort((left, right) => right.commits - left.commits)
      .slice(0, 4),
    churnHotspots: [...(context.metrics.churnHotspots ?? [])]
      .filter((hotspot) => pathSet.has(normalizePath(hotspot.path)))
      .sort((left, right) => right.commitsInWindow - left.commitsInWindow)
      .slice(0, 4),
    dependencyHotspots,
    factTitles,
    frameworkNames,
    graphNeighborPaths,
    graphUnresolvedSamples,
    hotspotSignals,
    orphanPaths,
  };
}

export function collectScopedSignals(
  paths: string[],
  context: {
    aiResult: AIResult;
  }
) {
  const pathSet = new Set(paths.map((path) => normalizePath(path)));

  const matchingFacts = (context.aiResult.repository_facts ?? []).filter((fact) =>
    fact.evidence.some((item) => pathSet.has(normalizePath(item.path)))
  );
  const matchingFindings = (context.aiResult.findings ?? []).filter((finding) =>
    finding.evidence.some((item) => pathSet.has(normalizePath(item.path)))
  );

  return {
    facts: matchingFacts,
    findings: matchingFindings,
  };
}
