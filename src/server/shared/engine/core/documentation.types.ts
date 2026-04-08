import type { AnalysisCoverage, DependencyNodeMetric } from "@/server/shared/types";

import type {
  ChangeCouplingRef,
  DependencyGraphEvidence,
  EntrypointRef,
  FileCategoryBreakdownItem,
  FrameworkFact,
  HotspotSignal,
  ModuleRef,
  RiskDerivedScores,
  RiskFindingRef,
  RiskRawMetrics,
  RouteInventory,
} from "./discovery.types";

export type DocumentationAudience = "newcomer" | "tech-lead";

export type DocumentationFocusSection =
  | "Overview"
  | "Architecture"
  | "API/Reference"
  | "Risks"
  | "Onboarding Map";

export const REPORT_FOCUS_SECTIONS = [
  "Overview",
  "Architecture",
  "API/Reference",
  "Risks",
  "Onboarding Map",
] as const satisfies readonly DocumentationFocusSection[];

export type ReportSectionKind =
  | "overview"
  | "architecture"
  | "api_reference"
  | "risks"
  | "onboarding";

export const REPORT_SECTION_KINDS = [
  "overview",
  "architecture",
  "api_reference",
  "risks",
  "onboarding",
] as const satisfies readonly ReportSectionKind[];

export type ReportSectionInput<TBody> = {
  audience: DocumentationAudience | "mixed";
  body: TBody;
  confidence: number;
  evidencePaths: string[];
  section: ReportSectionKind;
  summary: string[];
  title: string;
  unknowns: string[];
};

export type ModuleArchitectureSummary = Pick<
  ModuleRef,
  "apiSurface" | "categories" | "exports" | "parseTier" | "path"
>;

export type OverviewSectionBody = {
  configFiles: string[];
  primaryEntrypoints: string[];
  primaryModules: string[];
  repositoryKind: "library" | "mixed" | "service" | "unknown";
  stackProfile: string[];
};

export type ArchitectureSectionBody = {
  dependencyCycles: string[][];
  dependencyHotspots: DependencyNodeMetric[];
  graphReliability: DependencyGraphEvidence;
  modules: ModuleArchitectureSummary[];
  orphanModules: string[];
  primaryEntrypoints: string[];
};

export type ApiReferenceSectionBody = {
  entrypoints: EntrypointRef[];
  frameworkFacts: FrameworkFact[];
  publicSurfacePaths: string[];
  routeInventory: RouteInventory;
  sourceOfTruth: "extracted" | "mixed" | "openapi" | "unknown";
};

export type RisksSectionBody = {
  changeCoupling: ChangeCouplingRef[];
  dependencyCycles: string[][];
  derivedScores: RiskDerivedScores;
  findings: RiskFindingRef[];
  graphReliability: DependencyGraphEvidence;
  hotspots: HotspotSignal[];
  orphanModules: string[];
  rawMetrics: RiskRawMetrics;
};

export type OnboardingSectionBody = {
  apiPaths: string[];
  configPaths: string[];
  firstLookPaths: string[];
  newcomerSteps: string[];
  riskPaths: string[];
};

export type DocumentationInputModel = {
  api: {
    entrypoints: EntrypointRef[];
    frameworkFacts: FrameworkFact[];
    publicSurfacePaths: string[];
    routeInventory: RouteInventory;
  };
  architecture: {
    dependencyCycles: string[][];
    dependencyHotspots: DependencyNodeMetric[];
    graphReliability: DependencyGraphEvidence;
    modules: ModuleArchitectureSummary[];
    orphanModules: string[];
  };
  codebase: {
    configFiles: string[];
    fileCategoryBreakdown: FileCategoryBreakdownItem[];
    frameworkFacts: FrameworkFact[];
    languages: AnalysisCoverage["languagesByMode"];
    totalFiles: number;
  };
  report: {
    audiences: DocumentationAudience[];
    focusSections: DocumentationFocusSection[];
    primaryEntrypoints: string[];
    secondaryEntrypoints: string[];
    stackProfile: string[];
  };
  risks: {
    changeCoupling: ChangeCouplingRef[];
    hotspots: HotspotSignal[];
  };
  sections: {
    api_reference: ReportSectionInput<ApiReferenceSectionBody>;
    architecture: ReportSectionInput<ArchitectureSectionBody>;
    onboarding: ReportSectionInput<OnboardingSectionBody>;
    overview: ReportSectionInput<OverviewSectionBody>;
    risks: ReportSectionInput<RisksSectionBody>;
  };
};
