import { dumpDebug } from "@/server/utils/debug-logger";

import { buildEvidence, clamp } from "../core/common";
import type { ArtifactBuildParams, ArtifactBuildResult } from "../core/types";
import {
  buildReferenceEvidencePaths,
  getPrimaryArchitectureModules,
  getPrimaryEntrypointPaths,
} from "./report-helpers";
import { buildRiskSectionBody } from "./risk-model";

const FINDING_SEVERITY_WEIGHT = { CRITICAL: 4, HIGH: 3, LOW: 1, MODERATE: 2 } as const;

type ArtifactFact = ArtifactBuildResult["facts"][number];
type ArtifactFinding = ArtifactBuildResult["findings"][number];
type ArtifactContext = {
  busFactor: ArtifactBuildParams["busFactor"];
  evidence: ArtifactBuildParams["evidence"];
  metrics: ArtifactBuildParams["metrics"];
  moduleMap: ReturnType<typeof getPrimaryArchitectureModules>;
  primaryEntrypoints: ReturnType<typeof getPrimaryEntrypointPaths>;
  publicSurfacePaths: string[];
  referenceEvidence: string[];
  riskFindings: ArtifactFinding[];
  riskHotspotPaths: string[];
  teamRoles: ArtifactBuildParams["teamRoles"];
};

function compactArtifacts<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item != null);
}

function buildOwnershipEvidence(teamRoles: ArtifactBuildParams["teamRoles"]) {
  return teamRoles.map((role) => ({
    note: `${role.role} (${role.share}%)`,
    path: `github:contributors/${role.login}`,
  }));
}

function buildSecurityEvidence(metrics: ArtifactBuildParams["metrics"]) {
  return metrics.securityFindings.map((finding) => ({
    line: finding.line,
    note: finding.message,
    path: finding.path,
  }));
}

function buildPublicInterfaceEvidence(context: ArtifactContext) {
  const { evidence, primaryEntrypoints, publicSurfacePaths } = context;
  const paths =
    evidence.routeInventory.sourceFiles.length > 0
      ? evidence.routeInventory.sourceFiles
      : publicSurfacePaths.length > 0
        ? publicSurfacePaths
        : primaryEntrypoints;

  return buildEvidence(paths, "Public interface evidence");
}

function buildOverlapEvidence(paths: string[]) {
  return buildEvidence(paths, "High churn + structural centrality");
}

function buildPrimaryArchitectureEvidence(context: ArtifactContext) {
  return buildEvidence(
    context.moduleMap.slice(0, 10).map((module) => module.path),
    "Primary runtime module"
  );
}

function buildReferenceRootsEvidence(context: ArtifactContext) {
  return buildEvidence(
    context.referenceEvidence.length > 0
      ? context.referenceEvidence
      : context.metrics.mostComplexFiles
  );
}

function buildCoverageEvidence(context: ArtifactContext): ArtifactFact["evidence"] {
  const { analysisCoverage } = context.metrics;
  return [
    {
      note: `TypeScript AST: ${analysisCoverage.languagesByMode.typeScriptAst.join(", ") || "none"}`,
      path: "analysis://coverage/typescript-ast",
    },
    {
      note: `Tree-sitter: ${analysisCoverage.languagesByMode.treeSitter.join(", ") || "none"}`,
      path: "analysis://coverage/tree-sitter",
    },
    {
      note: `Heuristic fallback: ${analysisCoverage.languagesByMode.heuristic.join(", ") || "none"}`,
      path: "analysis://coverage/heuristic",
    },
  ];
}

function buildCoreFacts(context: ArtifactContext): ArtifactFact[] {
  const { evidence, metrics } = context;
  return [
    {
      category: "quality",
      confidence: "high",
      detail: `${metrics.fileCount} files, ${metrics.totalLoc} lines, ${metrics.languages.length} detected languages.`,
      evidence: buildReferenceRootsEvidence(context),
      id: "codebase-shape",
      title: "Codebase footprint is measured from repository contents",
    },
    {
      category: "configuration",
      confidence: "high",
      detail:
        evidence.configs.length > 0
          ? `${metrics.configFiles} configuration files were indexed for runtime and build context.`
          : "No dedicated configuration files were recognized by the analyzer.",
      evidence: buildEvidence(
        evidence.configs.map((config) => config.path),
        "Configuration inventory"
      ),
      id: "configuration-inventory",
      title: "Configuration inventory is explicit",
    },
    {
      category: "quality",
      confidence: metrics.analysisCoverage.parserCoveragePercent >= 70 ? "high" : "medium",
      detail: `Structural parsing covers ${metrics.analysisCoverage.parserCoveragePercent}% of analyzed files (${metrics.analysisCoverage.typeScriptAstFiles} via TypeScript AST, ${metrics.analysisCoverage.treeSitterFiles} via Tree-sitter, ${metrics.analysisCoverage.heuristicFiles} heuristic only).`,
      evidence: buildCoverageEvidence(context),
      id: "analysis-coverage",
      title: "Analysis depth is explicit per parser tier",
    },
  ];
}

function buildArchitectureFacts(context: ArtifactContext): ArtifactFact[] {
  const { evidence, moduleMap, primaryEntrypoints, referenceEvidence } = context;
  const facts: ArtifactFact[] = [];

  if (primaryEntrypoints.length > 0) {
    facts.push({
      category: "architecture",
      confidence: "high",
      detail: `Likely primary entrypoints/public surfaces: ${primaryEntrypoints.join(", ")}.`,
      evidence: buildEvidence(primaryEntrypoints, "Entrypoint"),
      id: "entrypoints",
      title: "Entrypoints are identified from repository structure",
    });
  }

  const graphReliability = evidence.dependencyGraph;
  if (graphReliability.unresolvedImportSpecifiers > 0) {
    facts.push({
      category: "architecture",
      confidence: "medium",
      detail: `${graphReliability.unresolvedImportSpecifiers} internal import paths could not be mapped to analyzed files; ${graphReliability.resolvedEdges} dependency edges resolved. Partial graph is common with path aliases or sparse file selection.`,
      evidence: graphReliability.unresolvedSamples.map((u) => ({
        note: `unresolved import: ${u.specifier}`,
        path: u.fromPath,
      })),
      id: "graph-reliability",
      title: "Import graph resolution is incomplete",
    });
  }

  facts.push({
    category: "architecture",
    confidence: evidence.dependencyCycles.length > 0 ? "high" : "medium",
    detail:
      evidence.dependencyCycles.length > 0
        ? `${evidence.dependencyCycles.length} dependency cycle groups were detected in the local dependency graph.`
        : "No dependency cycles were detected in the local dependency graph.",
    evidence: buildEvidence(
      evidence.dependencyCycles.length > 0
        ? (evidence.dependencyCycles[0] ?? [])
        : referenceEvidence,
      evidence.dependencyCycles.length > 0 ? "Dependency cycle" : "Graph roots"
    ),
    id: "dependency-cycles",
    title:
      evidence.dependencyCycles.length > 0
        ? "The dependency graph contains cycles"
        : "The dependency graph is acyclic in analyzed files",
  });

  if (moduleMap.length > 0) {
    facts.push({
      category: "architecture",
      confidence: "high",
      detail: `Primary architectural contour centers on ${moduleMap.length} runtime-relevant modules; non-runtime files stay in secondary evidence instead of dominating the report.`,
      evidence: buildPrimaryArchitectureEvidence(context),
      id: "primary-architecture-contour",
      title: "Primary architecture is separated from secondary repository evidence",
    });
  }

  return facts;
}

function buildFrameworkFacts(context: ArtifactContext): ArtifactFact[] {
  if (context.evidence.frameworkFacts.length === 0) {
    return [];
  }

  const topFrameworks = context.evidence.frameworkFacts.slice(0, 8);
  return [
    {
      category: "architecture",
      confidence: topFrameworks.some((fact) => fact.confidence >= 90) ? "high" : "medium",
      detail: `Detected framework/runtime profile: ${topFrameworks.map((fact) => fact.name).join(", ")}.`,
      evidence: topFrameworks.map((fact) => ({
        note: `${fact.category} (${fact.confidence}%)`,
        path: fact.sources[0] ?? "analysis://frameworks",
      })),
      id: "framework-profile",
      title: "Framework and runtime stack is inferred from layered evidence",
    },
  ];
}

function buildApiFacts(context: ArtifactContext): ArtifactFact[] {
  const facts: ArtifactFact[] = [
    {
      category: "api",
      confidence: "medium",
      detail:
        context.metrics.apiSurface > 0
          ? `${context.metrics.apiSurface} API surface signals were detected from routes, handlers, controllers, or exported entry procedures.`
          : "No clear API surface was detected from the selected files.",
      evidence: buildPublicInterfaceEvidence(context),
      id: "api-surface",
      title: "Public interface footprint is tracked",
    },
  ];

  const openapiInventory = context.metrics.openapiInventory;
  if (openapiInventory != null && openapiInventory.sourceFiles.length > 0) {
    facts.push({
      category: "api",
      confidence: openapiInventory.pathPatterns.length > 0 ? "high" : "medium",
      detail: `OpenAPI/Swagger-like documents found in ${openapiInventory.sourceFiles.length} file(s); ~${openapiInventory.estimatedOperations} HTTP operations (heuristic count).`,
      evidence: openapiInventory.sourceFiles.map((path) => ({
        note: "Spec candidate",
        path,
      })),
      id: "openapi-inventory",
      title: "Machine-readable API specs are indexed",
    });
  }

  return facts;
}

function buildOperationalFacts(context: ArtifactContext): ArtifactFact[] {
  const { metrics, teamRoles } = context;
  const facts: ArtifactFact[] = [];

  if (metrics.churnHotspots != null && metrics.churnHotspots.length > 0) {
    facts.push({
      category: "delivery",
      confidence: "medium",
      detail: `Recent git activity (last ~90 days, when history exists) clusters on: ${metrics.churnHotspots
        .map((candidate) => `${candidate.path} (${candidate.commitsInWindow} touches)`)
        .join(", ")}.`,
      evidence: metrics.churnHotspots.map((candidate) => ({
        note: `${candidate.commitsInWindow} commits in window`,
        path: candidate.path,
      })),
      id: "git-churn-hotspots",
      title: "Change frequency highlights active files",
    });
  }

  if (teamRoles.length > 0) {
    const leadRole = teamRoles[0]!;
    facts.push({
      category: "ownership",
      confidence: "medium",
      detail: `${leadRole.login} currently owns about ${leadRole.share}% of visible contribution share.`,
      evidence: buildOwnershipEvidence(teamRoles),
      id: "ownership-distribution",
      title: "Knowledge distribution is estimated from contributor share",
    });
  }

  return facts;
}

function buildSecurityFacts(context: ArtifactContext): ArtifactFact[] {
  if (context.metrics.securityFindings.length === 0) {
    return [];
  }

  return [
    {
      category: "security",
      confidence: "high",
      detail: `${context.metrics.securityFindings.length} secret or sensitive-pattern signals were raised during static scanning.`,
      evidence: buildSecurityEvidence(context.metrics),
      id: "security-signals",
      title: "Static secret scanning produced concrete signals",
    },
  ];
}

function buildManualFindings(context: ArtifactContext): ArtifactFinding[] {
  return compactArtifacts([
    buildOwnershipFinding(context),
    buildSecurityFinding(context),
    buildDuplicationFinding(context),
    buildHotspotOverlapFinding(context),
    buildOnboardingFinding(context),
  ]);
}

function buildOwnershipFinding(context: ArtifactContext): ArtifactFinding | null {
  const { busFactor, teamRoles } = context;
  if (busFactor > 2 || teamRoles.length === 0) {
    return null;
  }

  return {
    category: "change-risk",
    confidence: 76,
    evidence: buildOwnershipEvidence(teamRoles),
    id: "ownership-concentration",
    score: clamp(70 + teamRoles[0]!.share / 2, 0, 100),
    severity: teamRoles[0]!.share >= 60 ? "CRITICAL" : "HIGH",
    suggestedNextChange:
      "Spread ownership around the highest-risk files with reviews, pairing, and small runbooks.",
    summary: `Bus factor is ${busFactor}, with visible ownership concentrated around ${teamRoles[0]!.login}.`,
    title: "Knowledge concentration creates delivery risk",
    whyItMatters:
      "A small contributor set increases fragility when urgent fixes land in central modules.",
  };
}

function buildSecurityFinding(context: ArtifactContext): ArtifactFinding | null {
  const { metrics } = context;
  if (metrics.securityFindings.length === 0) {
    return null;
  }

  return {
    category: "security",
    confidence: 95,
    evidence: buildSecurityEvidence(metrics),
    id: "secret-signals",
    score: clamp(65 + metrics.securityFindings.length * 6, 0, 100),
    severity: metrics.securityFindings.some((finding) => finding.severity === "error")
      ? "HIGH"
      : "MODERATE",
    suggestedNextChange:
      "Review the flagged files, remove accidental secrets or secret-like fixtures, and replace them with safe placeholders.",
    summary: `${metrics.securityFindings.length} security scanner signals were detected.`,
    title: "Secret exposure signals need manual review",
    whyItMatters:
      "False positives cost trust, and real leaks can turn generated output into a security incident multiplier.",
  };
}

function buildDuplicationFinding(context: ArtifactContext): ArtifactFinding | null {
  const { evidence, metrics } = context;
  if (metrics.duplicationPercentage < 8) {
    return null;
  }

  return {
    category: "maintainability",
    confidence: 82,
    evidence: buildEvidence(
      evidence.hotspotSignals.length > 0
        ? evidence.hotspotSignals.map((signal) => signal.path)
        : metrics.mostComplexFiles
    ),
    id: "duplication-pressure",
    score: clamp(metrics.duplicationPercentage * 6, 0, 100),
    severity: metrics.duplicationPercentage >= 15 ? "HIGH" : "MODERATE",
    suggestedNextChange:
      "Extract one repeated workflow into a reusable abstraction before the duplication spreads.",
    summary: `Approximate duplication is ${metrics.duplicationPercentage}% of analyzed source lines.`,
    title: "Duplication is increasing maintenance cost",
    whyItMatters:
      "Repeated logic multiplies bug-fix effort and often hides behavior drift across similar flows.",
  };
}

function buildHotspotOverlapFinding(context: ArtifactContext): ArtifactFinding | null {
  const { metrics, riskHotspotPaths } = context;
  if (
    metrics.churnHotspots == null ||
    metrics.churnHotspots.length === 0 ||
    riskHotspotPaths.length === 0
  ) {
    return null;
  }

  const churnPaths = new Set(metrics.churnHotspots.map((candidate) => candidate.path));
  const overlap = riskHotspotPaths.filter((path) => churnPaths.has(path));
  if (overlap.length === 0) {
    return null;
  }

  return {
    category: "hotspot",
    confidence: 80,
    evidence: buildOverlapEvidence(overlap),
    id: "churn-static-overlap",
    score: clamp(60 + overlap.length * 8, 0, 100),
    severity: "HIGH",
    suggestedNextChange:
      "Treat overlap files as change-management priorities: smaller PRs, tests around edits, and ownership clarity.",
    summary: `Files appear both in static hotspots and frequent recent commits: ${overlap.join(", ")}.`,
    title: "Hotspots align with recent change frequency",
    whyItMatters:
      "When complex central files also change often, regressions and merge conflicts concentrate in the riskiest areas.",
  };
}

function buildOnboardingFinding(context: ArtifactContext): ArtifactFinding | null {
  const { evidence, metrics, primaryEntrypoints } = context;
  const onboardingRiskScore =
    (metrics.docDensity < 10 ? 40 : 0) +
    (primaryEntrypoints.length === 0 ? 30 : 0) +
    (evidence.configs.length === 0 ? 15 : 0) +
    (evidence.orphanModules.length > 4 ? 15 : 0);

  if (onboardingRiskScore < 30) {
    return null;
  }

  return {
    category: "onboarding",
    confidence: 68,
    evidence: buildEvidence(
      primaryEntrypoints.length > 0 ? primaryEntrypoints : evidence.orphanModules,
      "Onboarding starting point"
    ),
    id: "onboarding-friction",
    score: clamp(onboardingRiskScore, 0, 100),
    severity: onboardingRiskScore >= 60 ? "HIGH" : "MODERATE",
    suggestedNextChange:
      "Document the main entrypoints, runtime config map, and the first files a newcomer should inspect.",
    summary:
      primaryEntrypoints.length === 0
        ? "The analyzer could not confidently infer clear project entrypoints."
        : `Documentation density is ${metrics.docDensity}%, which is low for fast onboarding.`,
    title: "Project context is expensive to reconstruct",
    whyItMatters:
      "When entrypoints and config flow stay implicit, onboarding and incident response both slow down.",
  };
}

function sortFindingsBySeverity(findings: ArtifactFinding[]) {
  return [...findings].sort((left, right) => {
    return (
      FINDING_SEVERITY_WEIGHT[right.severity] - FINDING_SEVERITY_WEIGHT[left.severity] ||
      right.score - left.score
    );
  });
}

function buildArtifactContext(params: ArtifactBuildParams): ArtifactContext {
  const { busFactor, evidence, metrics, teamRoles } = params;
  const riskBody = buildRiskSectionBody(evidence, {
    changeCoupling: metrics.changeCoupling,
    complexityScore: metrics.complexityScore,
    graphReliability: metrics.graphReliability,
    hotspotSignals: metrics.hotspotSignals,
  });
  const primaryEntrypoints = getPrimaryEntrypointPaths(evidence.entrypoints);
  const moduleMap = getPrimaryArchitectureModules(evidence.modules);
  const publicSurfacePaths = Array.from(
    new Set(evidence.publicSurface.map((symbol) => symbol.path))
  ).sort((left, right) => left.localeCompare(right));
  const referenceEvidence = buildReferenceEvidencePaths({
    fallbackPaths: metrics.mostComplexFiles,
    modules: moduleMap,
    primaryEntrypoints,
  });

  return {
    busFactor,
    evidence,
    metrics,
    moduleMap,
    primaryEntrypoints,
    publicSurfacePaths,
    referenceEvidence,
    riskFindings: riskBody.findings,
    riskHotspotPaths: riskBody.hotspots.map((signal) => signal.path),
    teamRoles,
  };
}

function buildFacts(context: ArtifactContext): ArtifactFact[] {
  return [
    ...buildCoreFacts(context),
    ...buildArchitectureFacts(context),
    ...buildFrameworkFacts(context),
    ...buildApiFacts(context),
    ...buildOperationalFacts(context),
    ...buildSecurityFacts(context),
  ];
}

function buildFindings(context: ArtifactContext): ArtifactFinding[] {
  return sortFindingsBySeverity([...context.riskFindings, ...buildManualFindings(context)]);
}

// Builds compact facts/findings for the report layer without re-deriving architecture outside the canonical builders.
export function buildRepositoryArtifacts(params: ArtifactBuildParams): ArtifactBuildResult {
  const context = buildArtifactContext(params);
  const result: ArtifactBuildResult = {
    facts: buildFacts(context),
    findings: buildFindings(context),
  };
  dumpDebug("artifacts-facts-findings", result);
  return result;
}
