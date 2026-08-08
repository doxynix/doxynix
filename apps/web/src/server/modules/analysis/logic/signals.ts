import { uniq } from "es-toolkit";
import { normalize } from "pathe";

import type { AIResult } from "../engine/core/analysis-result.schemas";
import type { RepoMetrics } from "../engine/core/metrics.types";

export function collectScopedEntrySignals(
  paths: string[],
  context: {
    aiResult: AIResult;
    metrics: RepoMetrics;
  }
) {
  const normalizedPaths = uniq(paths.map((path) => normalize(path)));
  const pathSet = new Set(normalizedPaths);

  const frameworkNames = uniq(
    (context.metrics.frameworkFacts ?? [])
      .filter((fact) => fact.sources.some((source) => pathSet.has(normalize(source))))
      .map((fact) => fact.name)
  ).slice(0, 5);

  const hotspotSignals = [...(context.metrics.hotspotSignals ?? [])]
    .filter((signal) => pathSet.has(normalize(signal.path)))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const dependencyHotspots = [...context.metrics.dependencyHotspots]
    .filter((hotspot) => pathSet.has(normalize(hotspot.path)))
    .sort(
      (left, right) =>
        right.inbound +
        right.outbound +
        right.exports -
        (left.inbound + left.outbound + left.exports)
    )
    .slice(0, 4);

  const orphanPaths = uniq(
    context.metrics.orphanModules.map((path) => normalize(path)).filter((path) => pathSet.has(path))
  ).slice(0, 4);

  const graphUnresolvedSamples = (context.metrics.graphReliability?.unresolvedSamples ?? [])
    .filter((sample) => pathSet.has(normalize(sample.fromPath)))
    .slice(0, 4);

  const graphNeighborPaths = uniq(
    (context.metrics.graphPreviewEdges ?? [])
      .flatMap((edge) => {
        const fromPath = normalize(edge.fromPath);
        const toPath = normalize(edge.toPath);

        if (pathSet.has(fromPath) && !pathSet.has(toPath)) return [toPath];
        if (pathSet.has(toPath) && !pathSet.has(fromPath)) return [fromPath];
        return [];
      })
      .filter((path) => !pathSet.has(path))
  ).slice(0, 8);

  const factTitles = uniq(
    (context.aiResult.repository_facts ?? [])
      .filter((fact) => fact.evidence.some((item) => pathSet.has(normalize(item.path))))
      .map((fact) => fact.title)
  ).slice(0, 5);

  return {
    changeCoupling: [...(context.metrics.changeCoupling ?? [])]
      .filter(
        (pair) => pathSet.has(normalize(pair.fromPath)) || pathSet.has(normalize(pair.toPath))
      )
      .sort((left, right) => right.commits - left.commits)
      .slice(0, 4),
    churnHotspots: [...(context.metrics.churnHotspots ?? [])]
      .filter((hotspot) => pathSet.has(normalize(hotspot.path)))
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
  const pathSet = new Set(paths.map((path) => normalize(path)));

  const matchingFacts = (context.aiResult.repository_facts ?? []).filter((fact) =>
    fact.evidence.some((item) => pathSet.has(normalize(item.path)))
  );
  const matchingFindings = (context.aiResult.findings ?? []).filter((finding) =>
    finding.evidence.some((item) => pathSet.has(normalize(item.path)))
  );

  return {
    facts: matchingFacts,
    findings: matchingFindings,
  };
}
