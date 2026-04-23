import { dumpDebug } from "../../lib/debug-logger";
import { buildEvidence, clamp } from "../core/common";
import type {
  ChangeCouplingRef,
  DependencyGraphEvidence,
  HotspotSignal,
  RepositoryEvidence,
  RiskDerivedScores,
  RiskFindingRef,
  RiskRawMetrics,
} from "../core/discovery.types";
import type { RisksSectionBody } from "../core/documentation.types";
import type { RepoMetrics } from "../core/metrics.types";
import { RISK_SCORING, RISK_THRESHOLDS } from "../core/scoring-constants";

function severityForScore(score: number): RiskFindingRef["severity"] {
  if (score >= RISK_THRESHOLDS.critical) return "CRITICAL";
  if (score >= RISK_THRESHOLDS.high) return "HIGH";
  if (score >= RISK_THRESHOLDS.moderate) return "MODERATE";
  return "LOW";
}

function buildGraphReliability(
  evidence: RepositoryEvidence,
  metrics: Pick<RepoMetrics, "graphReliability">
): DependencyGraphEvidence {
  if (metrics.graphReliability == null) {
    return evidence.dependencyGraph;
  }

  return {
    ...evidence.dependencyGraph,
    resolvedEdges: metrics.graphReliability.resolvedEdges,
    unresolvedImportSpecifiers: metrics.graphReliability.unresolvedImportSpecifiers,
    unresolvedSamples: metrics.graphReliability.unresolvedSamples,
  };
}

function buildRiskRawMetrics(
  evidence: RepositoryEvidence,
  hotspots: HotspotSignal[],
  changeCoupling: ChangeCouplingRef[],
  graphReliability: DependencyGraphEvidence
): RiskRawMetrics {
  return {
    changeCouplingPairs: changeCoupling.length,
    dependencyCycleGroups: evidence.dependencyCycles.length,
    hotspotCount: hotspots.length,
    orphanModuleCount: evidence.orphanModules.length,
    resolvedEdges: graphReliability.resolvedEdges,
    strongestChangeCouplingCommits: Math.max(0, ...changeCoupling.map((pair) => pair.commits)),
    strongestHotspotScore: Math.max(0, ...hotspots.map((signal) => signal.score)),
    unresolvedInternalImports: graphReliability.unresolvedImportSpecifiers,
  };
}

function buildRiskDerivedScores(
  rawMetrics: RiskRawMetrics,
  metrics: Pick<RepoMetrics, "complexityScore">
): RiskDerivedScores {
  const derivedScores: RiskDerivedScores = {
    changeCouplingRisk: clamp(
      RISK_SCORING.changeCouplingBase +
        rawMetrics.strongestChangeCouplingCommits * RISK_SCORING.strongestCommitMultiplier +
        rawMetrics.changeCouplingPairs * RISK_SCORING.pairMultiplier,
      0,
      100
    ),
    dependencyCycleRisk: clamp(
      RISK_SCORING.dependencyCycleBase +
        rawMetrics.dependencyCycleGroups * RISK_SCORING.cycleMultiplier,
      0,
      100
    ),
    graphReliabilityRisk: clamp(
      rawMetrics.unresolvedInternalImports * RISK_SCORING.unresolvedImportMultiplier,
      0,
      100
    ),
    hotspotRisk: clamp(
      Math.round(
        rawMetrics.strongestHotspotScore * RISK_SCORING.hotspotScoreMultiplier +
          rawMetrics.hotspotCount * RISK_SCORING.hotspotCountMultiplier +
          metrics.complexityScore * RISK_SCORING.complexityWeightInHotspot
      ),
      0,
      100
    ),
    orphanModuleRisk: clamp(
      RISK_SCORING.orphanModuleBase +
        rawMetrics.orphanModuleCount * RISK_SCORING.orphanCountMultiplier,
      0,
      100
    ),
    overallRisk: 0,
  };

  derivedScores.overallRisk = clamp(
    Math.round(
      (derivedScores.changeCouplingRisk +
        derivedScores.dependencyCycleRisk +
        derivedScores.graphReliabilityRisk +
        derivedScores.hotspotRisk +
        derivedScores.orphanModuleRisk) /
        5
    ),
    0,
    100
  );

  return derivedScores;
}

function createRiskFinding(
  input: Omit<RiskFindingRef, "severity"> & { score: number }
): RiskFindingRef {
  return {
    ...input,
    severity: severityForScore(input.score),
  };
}

function buildDependencyCycleFinding(
  evidence: RepositoryEvidence,
  derivedScores: RiskDerivedScores
): null | RiskFindingRef {
  if (evidence.dependencyCycles.length === 0) return null;

  return createRiskFinding({
    category: "architecture",
    confidence: 92,
    evidence: buildEvidence(evidence.dependencyCycles[0] ?? [], "Break this cycle first"),
    id: "risk-dependency-cycles",
    score: derivedScores.dependencyCycleRisk,
    signal: "dependency-cycle",
    suggestedNextChange:
      "Break one cycle first by extracting a lower-level shared module or a small boundary interface.",
    summary: `Detected ${evidence.dependencyCycles.length} dependency cycle groups in the analyzed graph.`,
    title: "Dependency cycles increase architectural drag",
    whyItMatters:
      "Cycles increase blast radius, weaken isolation, and make safe refactoring harder across multiple modules.",
  });
}

function buildHotspotFinding(
  hotspots: HotspotSignal[],
  derivedScores: RiskDerivedScores
): null | RiskFindingRef {
  if (hotspots.length === 0) return null;

  return createRiskFinding({
    category: "hotspot",
    confidence: 78,
    evidence: buildEvidence(
      hotspots.slice(0, 10).map((signal) => signal.path),
      "Static hotspot candidate"
    ),
    id: "risk-hotspots",
    score: derivedScores.hotspotRisk,
    signal: "hotspot",
    suggestedNextChange:
      "Refactor the first hotspot by shrinking responsibilities or extracting lower-risk helpers around the core flow.",
    summary: `Top hotspots combine complexity, centrality, and API weight: ${hotspots
      .slice(0, 8)
      .map((signal) => signal.path)
      .join(", ")}.`,
    title: "A small set of files dominates change risk",
    whyItMatters:
      "When central and complex files keep growing, routine edits become slower, harder to review, and more error-prone.",
  });
}

function buildChangeCouplingFinding(
  changeCoupling: ChangeCouplingRef[],
  derivedScores: RiskDerivedScores
): null | RiskFindingRef {
  if (changeCoupling.length === 0) return null;

  const strongestPairs = changeCoupling.slice(0, 6);

  return createRiskFinding({
    category: "change-risk",
    confidence: 80,
    evidence: strongestPairs.flatMap((pair) => [
      {
        note: `${pair.commits} shared commits with ${pair.toPath}`,
        path: pair.fromPath,
      },
      {
        note: `${pair.commits} shared commits with ${pair.fromPath}`,
        path: pair.toPath,
      },
    ]),
    id: "risk-change-coupling",
    score: derivedScores.changeCouplingRisk,
    signal: "change-coupling",
    suggestedNextChange:
      "Review the strongest co-change pairs and decide whether shared abstractions or boundary cleanup would reduce coordinated edits.",
    summary: `Frequent co-change pairs suggest hidden coupling across ${strongestPairs.length} file pairs.`,
    title: "Change coupling reveals hidden coordination costs",
    whyItMatters:
      "Files that change together repeatedly often share an implicit responsibility that the static module graph does not explain well enough.",
  });
}

function buildOrphanModuleFinding(
  evidence: RepositoryEvidence,
  derivedScores: RiskDerivedScores
): null | RiskFindingRef {
  if (evidence.orphanModules.length === 0) return null;

  return createRiskFinding({
    category: "maintainability",
    confidence: 72,
    evidence: buildEvidence(evidence.orphanModules.slice(0, 8), "Orphan module candidate"),
    id: "risk-orphan-modules",
    score: derivedScores.orphanModuleRisk,
    signal: "orphan-module",
    suggestedNextChange:
      "Review orphan modules for dead code, implicit entrypoints, or boundaries that should be documented explicitly.",
    summary: `Detected ${evidence.orphanModules.length} runtime-relevant modules without inbound references or primary-entrypoint status.`,
    title: "Orphan modules make architecture harder to reason about",
    whyItMatters:
      "Modules that sit outside clear dependency flows often confuse newcomers and hide dead or poorly integrated code paths.",
  });
}

function buildGraphReliabilityFinding(
  graphReliability: DependencyGraphEvidence,
  derivedScores: RiskDerivedScores
): null | RiskFindingRef {
  if (graphReliability.unresolvedImportSpecifiers === 0) return null;

  return createRiskFinding({
    category: "architecture",
    confidence: 70,
    evidence: graphReliability.unresolvedSamples.map((sample) => ({
      note: `unresolved import: ${sample.specifier}`,
      path: sample.fromPath,
    })),
    id: "risk-graph-reliability",
    score: derivedScores.graphReliabilityRisk,
    signal: "graph-reliability",
    suggestedNextChange:
      "Improve import/path resolution so the architectural graph is more complete and the resulting docs are more trustworthy.",
    summary: `${graphReliability.unresolvedImportSpecifiers} internal import paths could not be mapped to analyzed files.`,
    title: "Dependency graph reliability is partial",
    whyItMatters:
      "When internal imports remain unresolved, architectural conclusions and refactoring guidance become less reliable.",
  });
}

function buildRiskFindings(
  evidence: RepositoryEvidence,
  hotspots: HotspotSignal[],
  changeCoupling: ChangeCouplingRef[],
  graphReliability: DependencyGraphEvidence,
  derivedScores: RiskDerivedScores
) {
  return [
    buildDependencyCycleFinding(evidence, derivedScores),
    buildHotspotFinding(hotspots, derivedScores),
    buildChangeCouplingFinding(changeCoupling, derivedScores),
    buildOrphanModuleFinding(evidence, derivedScores),
    buildGraphReliabilityFinding(graphReliability, derivedScores),
  ]
    .filter((finding): finding is RiskFindingRef => finding != null)
    .sort((left, right) => right.score - left.score);
}

export function buildRiskSectionBody(
  evidence: RepositoryEvidence,
  metrics: Pick<
    RepoMetrics,
    "changeCoupling" | "complexityScore" | "graphReliability" | "hotspotSignals"
  >
): RisksSectionBody {
  const hotspots =
    evidence.hotspotSignals.length > 0 ? evidence.hotspotSignals : (metrics.hotspotSignals ?? []);
  const changeCoupling = metrics.changeCoupling ?? [];
  const graphReliability = buildGraphReliability(evidence, metrics);
  const rawMetrics = buildRiskRawMetrics(evidence, hotspots, changeCoupling, graphReliability);
  const derivedScores = buildRiskDerivedScores(rawMetrics, metrics);
  const findings = buildRiskFindings(
    evidence,
    hotspots,
    changeCoupling,
    graphReliability,
    derivedScores
  );

  const riskBody: RisksSectionBody = {
    changeCoupling,
    dependencyCycles: evidence.dependencyCycles,
    derivedScores,
    findings,
    graphReliability,
    hotspots,
    orphanModules: evidence.orphanModules,
    rawMetrics,
  };

  void dumpDebug("risk-model", riskBody);
  return riskBody;
}
