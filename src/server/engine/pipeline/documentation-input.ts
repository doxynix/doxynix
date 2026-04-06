import { FileClassifier } from "../core/file-classifier";
import { selectRepositoryFrameworkFacts } from "../core/framework-catalog";
import {
  REPORT_FOCUS_SECTIONS,
  type ApiReferenceSectionBody,
  type ArchitectureSectionBody,
  type DocumentationInputModel,
  type OnboardingSectionBody,
  type OverviewSectionBody,
  type RepoMetrics,
  type RepositoryEvidence,
} from "../core/types";
import {
  buildSectionInput,
  getPrimaryArchitectureModules,
  getPrimaryEntrypointPaths,
  getSecondaryEntrypointPaths,
  inferRepositoryKind,
  uniquePaths,
} from "./report-helpers";
import { buildRiskSectionBody } from "./risk-model";

type FrameworkFactInput = DocumentationInputModel["api"]["frameworkFacts"][number];
type EntrypointInput = DocumentationInputModel["api"]["entrypoints"][number];
type RouteInventoryInput = DocumentationInputModel["api"]["routeInventory"];
type HotspotInput = DocumentationInputModel["risks"]["hotspots"][number];
type ArchitectureModuleInput = ArchitectureSectionBody["modules"][number];
type DocumentationSections = DocumentationInputModel["sections"];

type DocumentationContext = {
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
        return FileClassifier.isPrimaryEntrypointFile(entrypoint.path);
      }

      return !FileClassifier.isPrimaryContourExcluded(entrypoint.path);
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
    FileClassifier.isPrimaryApiEvidenceFile(route.sourcePath)
  );
  const filteredSourceFiles = FileClassifier.filterPrimaryApiEvidencePaths(
    inventory.sourceFiles,
    48
  );

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
  return (
    evidence.hotspotSignals.length > 0 ? evidence.hotspotSignals : (metrics.hotspotSignals ?? [])
  ).map((signal) => ({
    categories: signal.categories as HotspotInput["categories"],
    churnScore: signal.churnScore,
    complexity: signal.complexity,
    inbound: signal.inbound,
    outbound: signal.outbound,
    path: signal.path,
    score: signal.score,
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

function buildDocumentationContext(
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

function buildOverviewSection(
  evidence: RepositoryEvidence,
  context: DocumentationContext
): DocumentationInputModel["sections"]["overview"] {
  const body: OverviewSectionBody = {
    configFiles: evidence.configs.map((config) => config.path),
    primaryEntrypoints: context.primaryEntrypoints,
    primaryModules: context.architectureModules.slice(0, 8).map((module) => module.path),
    repositoryKind: inferRepositoryKind({
      primaryEntrypoints: context.primaryEntrypoints,
      routeInventory: context.routeInventory,
    }),
    stackProfile: context.stackProfile,
  };

  return buildSectionInput({
    audience: "mixed",
    body,
    confidence:
      60 +
      (body.primaryEntrypoints.length > 0 ? 15 : 0) +
      (body.stackProfile.length > 0 ? 15 : 0) +
      (body.primaryModules.length > 0 ? 10 : 0),
    evidencePaths: [
      ...body.primaryEntrypoints,
      ...body.primaryModules,
      ...body.configFiles.slice(0, 6),
    ],
    section: "overview",
    summary: [
      `Repository kind inferred as ${body.repositoryKind}.`,
      body.stackProfile.length > 0
        ? `Stack profile: ${body.stackProfile.slice(0, 8).join(", ")}.`
        : "Stack profile is only partially known.",
      body.primaryEntrypoints.length > 0
        ? `Primary entrypoints: ${body.primaryEntrypoints.slice(0, 5).join(", ")}.`
        : "Primary entrypoints are only partially known.",
    ],
    title: "Overview",
    unknowns: [
      ...(body.primaryEntrypoints.length === 0
        ? ["Primary entrypoints are only partially known."]
        : []),
      ...(body.stackProfile.length === 0
        ? ["Framework/runtime stack is only partially known."]
        : []),
      ...(body.repositoryKind === "unknown"
        ? ["Repository kind could not be inferred confidently."]
        : []),
    ],
  });
}

function buildArchitectureSection(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics,
  context: DocumentationContext
): DocumentationInputModel["sections"]["architecture"] {
  const body: ArchitectureSectionBody = {
    dependencyCycles: evidence.dependencyCycles,
    dependencyHotspots: metrics.dependencyHotspots,
    graphReliability: context.graphReliability,
    modules: context.architectureModules,
    orphanModules: evidence.orphanModules,
    primaryEntrypoints: context.primaryEntrypoints,
  };

  return buildSectionInput({
    audience: "mixed",
    body,
    confidence:
      62 +
      (body.modules.length > 0 ? 18 : 0) +
      (body.primaryEntrypoints.length > 0 ? 10 : 0) -
      Math.min(20, context.graphReliability.unresolvedImportSpecifiers),
    evidencePaths: [
      ...body.primaryEntrypoints,
      ...body.modules.slice(0, 10).map((module) => module.path),
      ...body.orphanModules.slice(0, 4),
    ],
    section: "architecture",
    summary: [
      body.modules.length > 0
        ? `Primary runtime-relevant modules: ${body.modules
            .slice(0, 5)
            .map((module) => module.path)
            .join(", ")}.`
        : "Primary runtime module boundaries are only partially known.",
      body.dependencyCycles.length > 0
        ? `Dependency cycle groups detected: ${body.dependencyCycles.length}.`
        : "No dependency cycles were detected in the analyzed graph.",
      `Resolved dependency edges: ${body.graphReliability.resolvedEdges}.`,
    ],
    title: "Architecture",
    unknowns: [
      ...(context.graphReliability.unresolvedImportSpecifiers > 0
        ? [
            "Dependency graph has unresolved internal imports, so some relationships may be partial.",
          ]
        : []),
      ...(evidence.orphanModules.length > 0
        ? ["Some runtime-relevant modules sit outside clear inbound dependency flows."]
        : []),
    ],
  });
}

function buildApiReferenceSection(
  evidence: RepositoryEvidence,
  context: DocumentationContext
): DocumentationInputModel["sections"]["api_reference"] {
  const apiEntrypoints = context.entrypoints
    .filter((entrypoint) => entrypoint.kind === "library" || entrypoint.kind === "runtime")
    .filter((entrypoint) => FileClassifier.isPrimaryApiEvidenceFile(entrypoint.path))
    .slice(0, 24);
  const publicSurfacePaths = uniquePaths(
    evidence.publicSurface.length > 0
      ? evidence.publicSurface
          .map((symbol) => symbol.path)
          .filter((path) => FileClassifier.isPrimaryApiEvidenceFile(path))
      : context.entrypoints
          .filter((entrypoint) => entrypoint.kind === "library")
          .map((entrypoint) => entrypoint.path)
          .filter((path) => FileClassifier.isPrimaryApiEvidenceFile(path)),
    48
  );
  const hasConcreteRuntimeApi =
    context.routeInventory.sourceFiles.length > 0 &&
    (context.routeInventory.httpRoutes.length > 0 || context.routeInventory.rpcProcedures > 0);
  const body: ApiReferenceSectionBody = {
    entrypoints: apiEntrypoints,
    frameworkFacts: context.frameworkFacts,
    publicSurfacePaths,
    routeInventory: context.routeInventory,
    sourceOfTruth: hasConcreteRuntimeApi ? context.routeInventory.source : "unknown",
  };

  return buildSectionInput({
    audience: "mixed",
    body,
    confidence:
      55 +
      (hasConcreteRuntimeApi ? 20 : 0) +
      (body.publicSurfacePaths.length > 0 ? 15 : 0) +
      (context.frameworkFacts.length > 0 ? 10 : 0),
    evidencePaths: [
      ...body.entrypoints.map((entrypoint) => entrypoint.path),
      ...body.publicSurfacePaths,
      ...context.routeInventory.sourceFiles,
    ],
    section: "api_reference",
    summary: [
      hasConcreteRuntimeApi && context.routeInventory.estimatedOperations > 0
        ? `Estimated public API operations: ${context.routeInventory.estimatedOperations}.`
        : body.publicSurfacePaths.length > 0
          ? "Repository exposes a framework/library public surface rather than a concrete application HTTP API."
          : "No explicit HTTP operation inventory was extracted.",
      body.publicSurfacePaths.length > 0
        ? `Public interface paths: ${body.publicSurfacePaths.slice(0, 5).join(", ")}.`
        : "Public interface paths are only partially known.",
      `API/reference source of truth: ${body.sourceOfTruth}.`,
    ],
    title: "API/Reference",
    unknowns: [
      ...(context.routeInventory.sourceFiles.length === 0 && body.publicSurfacePaths.length === 0
        ? ["Public interface surface could not be identified confidently."]
        : []),
      ...(!hasConcreteRuntimeApi && body.publicSurfacePaths.length > 0
        ? [
            "This repository looks more like a framework/library public surface than a concrete application API.",
          ]
        : []),
      ...(context.routeInventory.source === "extracted" &&
      context.routeInventory.estimatedOperations === 0
        ? [
            "HTTP operation inventory is intentionally treated as partial because no strong runtime route evidence was found.",
          ]
        : []),
    ],
  });
}

function buildOnboardingSection(
  evidence: RepositoryEvidence,
  apiReferenceSection: DocumentationInputModel["sections"]["api_reference"],
  context: DocumentationContext
): DocumentationInputModel["sections"]["onboarding"] {
  const firstLookPaths = uniquePaths(
    [
      ...context.primaryEntrypoints,
      ...context.architectureModules.slice(0, 6).map((module) => module.path),
      ...evidence.configs.slice(0, 4).map((config) => config.path),
    ],
    12
  );
  const body: OnboardingSectionBody = {
    apiPaths: uniquePaths(
      [
        ...context.routeInventory.sourceFiles,
        ...apiReferenceSection.body.publicSurfacePaths.slice(0, 8),
      ],
      12
    ),
    configPaths: evidence.configs.map((config) => config.path).slice(0, 12),
    firstLookPaths,
    newcomerSteps: [
      context.primaryEntrypoints.length > 0
        ? `Start with the primary entrypoints: ${context.primaryEntrypoints.slice(0, 3).join(", ")}.`
        : "Start with the highest-signal runtime modules because no clear primary entrypoint was inferred.",
      evidence.configs.length > 0
        ? `Review runtime and build configuration in: ${evidence.configs
            .slice(0, 3)
            .map((config) => config.path)
            .join(", ")}.`
        : "Configuration files were not confidently identified from the analyzed selection.",
      context.routeInventory.sourceFiles.length > 0 ||
      apiReferenceSection.body.publicSurfacePaths.length > 0
        ? `Inspect the public interface via: ${[...context.routeInventory.sourceFiles, ...apiReferenceSection.body.publicSurfacePaths].slice(0, 3).join(", ")}.`
        : "Public API/reference entry files were not confidently identified from the analyzed selection.",
      context.risksBody.hotspots.length > 0
        ? `Before making changes, inspect the highest-risk files: ${context.risksBody.hotspots
            .slice(0, 3)
            .map((signal) => signal.path)
            .join(", ")}.`
        : "No strong structural hotspots were identified from the analyzed selection.",
    ],
    riskPaths: context.risksBody.hotspots.slice(0, 8).map((signal) => signal.path),
  };

  return buildSectionInput({
    audience: "newcomer",
    body,
    confidence:
      58 +
      (body.firstLookPaths.length > 0 ? 18 : 0) +
      (body.configPaths.length > 0 ? 10 : 0) +
      (body.apiPaths.length > 0 ? 8 : 0),
    evidencePaths: [
      ...body.firstLookPaths,
      ...body.configPaths,
      ...body.apiPaths,
      ...body.riskPaths,
    ],
    section: "onboarding",
    summary: [
      body.firstLookPaths.length > 0
        ? `Suggested first-look paths: ${body.firstLookPaths.slice(0, 5).join(", ")}.`
        : "No clear first-look paths were inferred.",
      body.riskPaths.length > 0
        ? `Inspect risky files early: ${body.riskPaths.slice(0, 4).join(", ")}.`
        : "No strong risk paths were inferred for onboarding.",
    ],
    title: "Onboarding Map",
    unknowns: [
      ...(context.primaryEntrypoints.length === 0
        ? ["Onboarding path starts from modules rather than a clear bootstrap file."]
        : []),
      ...(evidence.configs.length === 0
        ? ["Configuration starting points are not confidently known."]
        : []),
    ],
  });
}

function buildRisksSection(
  context: DocumentationContext
): DocumentationInputModel["sections"]["risks"] {
  return buildSectionInput({
    audience: "tech-lead",
    body: context.risksBody,
    confidence:
      55 +
      Math.round(context.risksBody.derivedScores.overallRisk * 0.25) +
      (context.risksBody.findings.length > 0 ? 8 : 0),
    evidencePaths: context.risksBody.findings.flatMap((finding) =>
      finding.evidence.map((item) => item.path)
    ),
    section: "risks",
    summary: [
      context.risksBody.findings.length > 0
        ? `Top risk signals: ${context.risksBody.findings
            .slice(0, 3)
            .map((finding) => finding.title)
            .join("; ")}.`
        : "No strong structural hotspots were inferred.",
      context.risksBody.rawMetrics.dependencyCycleGroups > 0
        ? `Dependency cycles detected: ${context.risksBody.rawMetrics.dependencyCycleGroups}.`
        : "No dependency cycles were detected.",
      context.risksBody.rawMetrics.changeCouplingPairs > 0
        ? `Change coupling pairs detected: ${context.risksBody.rawMetrics.changeCouplingPairs}.`
        : "No strong change-coupling pairs were detected.",
    ],
    title: "Risks",
    unknowns: [
      ...(context.risksBody.rawMetrics.changeCouplingPairs === 0
        ? ["Change coupling is unavailable or not strong enough to surface."]
        : []),
      ...(context.risksBody.rawMetrics.hotspotCount === 0
        ? ["Structural hotspots were not confidently identified."]
        : []),
      ...(context.risksBody.rawMetrics.unresolvedInternalImports > 0
        ? [
            "Some internal dependencies remain unresolved, so architectural risk is only partially known.",
          ]
        : []),
    ],
  });
}

function buildDocumentationSections(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics,
  context: DocumentationContext
): DocumentationSections {
  const overview = buildOverviewSection(evidence, context);
  const architecture = buildArchitectureSection(evidence, metrics, context);
  const apiReference = buildApiReferenceSection(evidence, context);
  const onboarding = buildOnboardingSection(evidence, apiReference, context);
  const risks = buildRisksSection(context);

  return {
    api_reference: apiReference,
    architecture,
    onboarding,
    overview,
    risks,
  };
}

function buildApiInput(
  context: DocumentationContext,
  sections: DocumentationSections
): DocumentationInputModel["api"] {
  return {
    entrypoints: context.entrypoints,
    frameworkFacts: context.frameworkFacts,
    publicSurfacePaths: sections.api_reference.body.publicSurfacePaths,
    routeInventory: context.routeInventory,
  };
}

function buildArchitectureInput(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics,
  context: DocumentationContext
): DocumentationInputModel["architecture"] {
  return {
    dependencyCycles: evidence.dependencyCycles,
    dependencyHotspots: metrics.dependencyHotspots,
    graphReliability: context.graphReliability,
    modules: context.architectureModules,
    orphanModules: evidence.orphanModules,
  };
}

function buildCodebaseInput(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics,
  context: DocumentationContext
): DocumentationInputModel["codebase"] {
  const fileCategoryBreakdown =
    evidence.fileCategoryBreakdown.length > 0
      ? evidence.fileCategoryBreakdown
      : (metrics.fileCategoryBreakdown ?? []);

  return {
    configFiles: evidence.configs.map((config) => config.path),
    fileCategoryBreakdown: fileCategoryBreakdown.map((item) => ({
      category: item.category,
      count: item.count,
    })),
    frameworkFacts: context.frameworkFacts,
    languages: metrics.analysisCoverage.languagesByMode,
    totalFiles: metrics.fileCount,
  };
}

function buildReportInput(context: DocumentationContext): DocumentationInputModel["report"] {
  return {
    audiences: ["newcomer", "tech-lead"],
    focusSections: [...REPORT_FOCUS_SECTIONS],
    primaryEntrypoints: context.primaryEntrypoints,
    secondaryEntrypoints: context.secondaryEntrypoints,
    stackProfile: context.stackProfile,
  };
}

function buildRiskInput(context: DocumentationContext): DocumentationInputModel["risks"] {
  return {
    changeCoupling: context.risksBody.changeCoupling,
    hotspots: context.hotspots.length > 0 ? context.hotspots : context.risksBody.hotspots,
  };
}

// Canonical bridge from deterministic backend analysis to section-first report inputs for docs and AI writers.
export function buildDocumentationInputModel(
  evidence: RepositoryEvidence,
  metrics: RepoMetrics
): DocumentationInputModel {
  const context = buildDocumentationContext(evidence, metrics);
  const sections = buildDocumentationSections(evidence, metrics, context);

  return {
    api: buildApiInput(context, sections),
    architecture: buildArchitectureInput(evidence, metrics, context),
    codebase: buildCodebaseInput(evidence, metrics, context),
    report: buildReportInput(context),
    risks: buildRiskInput(context),
    sections,
  };
}
