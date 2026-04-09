import type { RepositoryEvidence } from "../core/discovery.types";
import { REPORT_FOCUS_SECTIONS, type DocumentationInputModel } from "../core/documentation.types";
import type { RepoMetrics } from "../core/metrics.types";
import {
  buildDocumentationContext,
  type DocumentationContext,
} from "./documentation-input-context";
import { buildDocumentationSections } from "./documentation-input-sections";

function buildApiInput(
  context: DocumentationContext,
  sections: DocumentationInputModel["sections"]
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
