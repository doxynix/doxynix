import type { RepositoryEvidence } from "../core/discovery.types";
import type {
  ApiReferenceSectionBody,
  DocumentationInputModel,
  OnboardingSectionBody,
  OverviewSectionBody,
} from "../core/documentation.types";
import type { RepoMetrics } from "../core/metrics.types";
import { ProjectPolicy } from "../core/project-policy";
import type { DocumentationContext } from "./documentation-input-context";
import { buildSectionInput, inferRepositoryKind, uniquePaths } from "./report-helpers";

type DocumentationSections = DocumentationInputModel["sections"];

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
  const body = {
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
    .filter((entrypoint) => ProjectPolicy.isPrimaryApiSurface(entrypoint.path))
    .slice(0, 24);
  const publicSurfacePaths = uniquePaths(
    evidence.publicSurface.length > 0
      ? evidence.publicSurface
          .map((symbol) => symbol.path)
          .filter((path) => ProjectPolicy.isPrimaryApiSurface(path))
      : context.entrypoints
          .filter((entrypoint) => entrypoint.kind === "library")
          .map((entrypoint) => entrypoint.path)
          .filter((path) => ProjectPolicy.isPrimaryApiSurface(path)),
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

export function buildDocumentationSections(
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
