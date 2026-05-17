import type { HotspotSignal, RepositoryEvidence } from "../core/discovery.types";
import type { ArchitectureSectionBody, DocumentationInputModel } from "../core/documentation.types";
import { selectRepositoryFrameworkFacts } from "../core/framework-catalog";
import type { RepoMetrics } from "../core/metrics.types";
import { ProjectPolicy } from "../core/project-policy";
import {
  getPrimaryArchitectureModules,
  getPrimaryEntrypointPaths,
  getSecondaryEntrypointPaths,
} from "./report-helpers";
import { buildRiskSectionBody } from "./risk-model";

type FrameworkFactInput = DocumentationInputModel["api"]["frameworkFacts"][number];
type EntrypointInput = DocumentationInputModel["api"]["entrypoints"][number];
type RouteInventoryInput = DocumentationInputModel["api"]["routeInventory"];
type HotspotInput = DocumentationInputModel["risks"]["hotspots"][number];
type ArchitectureModuleInput = ArchitectureSectionBody["modules"][number];

export type DocumentationContext = {
  architectureModules: ArchitectureModuleInput[];
  entrypoints: EntrypointInput[];
  frameworkFacts: FrameworkFactInput[];
  graphReliability: RepositoryEvidence["dependencyGraph"];
  hotspots: HotspotInput[];
  primaryEntrypoints: string[];
  risksBody: DocumentationInputModel["sections"]["risks"]["body"];
  routeInventory: RouteInventoryInput;
  secondaryEntrypoints: string[];
  stackProfile: string[];
};

function buildFrameworkFacts(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics
): FrameworkFactInput[] {
  return selectRepositoryFrameworkFacts(
    evidence.frameworkFacts.length > 0 ? evidence.frameworkFacts : (metrics.frameworkFacts ?? [])
  ).map((fact) => ({
    category: fact.category as FrameworkFactInput["category"],
    confidence: fact.confidence,
    name: fact.name,
    sources: fact.sources,
  }));
}

function buildEntrypoints(evidence: RepositoryEvidence, metrics: RepoMetrics): EntrypointInput[] {
  const canonicalEntrypoints =
    evidence.entrypoints.length > 0 ? evidence.entrypoints : (metrics.entrypointDetails ?? []);

  return canonicalEntrypoints
    .filter((entrypoint) => {
      if (entrypoint.kind === "library" || entrypoint.kind === "runtime") {
        return ProjectPolicy.isPrimaryEntrypoint(entrypoint.path);
      }

      return !ProjectPolicy.isPrimaryContourExcluded(entrypoint.path);
    })
    .map((entrypoint) => ({
      confidence: entrypoint.confidence,
      kind: entrypoint.kind,
      path: entrypoint.path,
      reason: entrypoint.reason,
    }));
}

function buildRouteInventory(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics,
  frameworkFacts: FrameworkFactInput[]
): RouteInventoryInput {
  const inventory = metrics.routeInventory ?? evidence.routeInventory;

  const filteredRoutes = inventory.httpRoutes.filter((route) =>
    ProjectPolicy.isPrimaryApiSurface(route.sourcePath)
  );
  const filteredSourceFiles = ProjectPolicy.filterPrimaryApiSurfacePaths(inventory.sourceFiles, 48);

  return {
    ...inventory,
    estimatedOperations:
      filteredRoutes.length > 0 || filteredSourceFiles.length > 0
        ? filteredRoutes.length + inventory.rpcProcedures
        : 0,
    frameworks: frameworkFacts.map((fact) => fact.name),
    httpRoutes: filteredRoutes,
    rpcProcedures: filteredSourceFiles.length > 0 ? inventory.rpcProcedures : 0,
    sourceFiles: filteredSourceFiles,
  };
}

function buildHotspots(evidence: RepositoryEvidence, metrics: RepoMetrics): HotspotInput[] {
  const hotspotCandidates =
    evidence.hotspotSignals.length > 0 ? evidence.hotspotSignals : (metrics.hotspotSignals ?? []);

  return hotspotCandidates.map<HotspotInput>((signal) => ({
    categories: signal.categories as HotspotInput["categories"],
    churnScore: signal.churnScore,
    complexity: signal.complexity,
    confidence: signal.confidence,
    inbound: signal.inbound,
    outbound: signal.outbound,
    path: signal.path,
    score: signal.score,
    source: signal.source as HotspotSignal["source"],
  }));
}

function buildArchitectureModules(evidence: RepositoryEvidence): ArchitectureModuleInput[] {
  return getPrimaryArchitectureModules(evidence.modules).map((module) => ({
    apiSurface: module.apiSurface,
    categories: module.categories,
    exports: module.exports,
    parseTier: module.parseTier,
    path: module.path,
  }));
}

function buildStackProfile(
  frameworkFacts: FrameworkFactInput[],
  metrics: RepoMetrics,
  routeInventory: RouteInventoryInput
) {
  return Array.from(
    new Set([
      ...frameworkFacts.map((fact) => fact.name),
      ...metrics.techStack,
      ...(routeInventory.source !== "extracted" ? ["OpenAPI"] : []),
    ])
  ).sort((left, right) => left.localeCompare(right));
}

function mergeGraphReliability(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics
): RepositoryEvidence["dependencyGraph"] {
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

export function buildDocumentationContext(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics
): DocumentationContext {
  const graphReliability = mergeGraphReliability(evidence, metrics);
  const frameworkFacts = buildFrameworkFacts(evidence, metrics);
  const entrypoints = buildEntrypoints(evidence, metrics);
  const routeInventory = buildRouteInventory(evidence, metrics, frameworkFacts);
  const hotspots = buildHotspots(evidence, metrics);
  const architectureModules = buildArchitectureModules(evidence);
  const primaryEntrypoints = getPrimaryEntrypointPaths(entrypoints);
  const secondaryEntrypoints = getSecondaryEntrypointPaths(entrypoints);
  const stackProfile = buildStackProfile(frameworkFacts, metrics, routeInventory);
  const risksBody = buildRiskSectionBody(evidence, {
    changeCoupling: metrics.changeCoupling,
    complexityScore: metrics.complexityScore,
    graphReliability,
    hotspotSignals: metrics.hotspotSignals,
  });

  return {
    architectureModules,
    entrypoints,
    frameworkFacts,
    graphReliability,
    hotspots,
    primaryEntrypoints,
    risksBody,
    routeInventory,
    secondaryEntrypoints,
    stackProfile,
  };
}
