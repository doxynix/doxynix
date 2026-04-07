import type { Repo } from "@prisma/client";

import type {
  AnalysisCoverage,
  ChurnHotspot,
  DependencyNodeMetric,
  GraphReliability,
  OpenApiInventory,
  RepositoryFact,
  RepositoryFinding,
  TeamRole,
  TsStaticHint,
} from "@/server/shared/types";

export type {
  AnalysisCoverage,
  ChurnHotspot,
  DependencyNodeMetric,
  GraphReliability,
  OpenApiInventory,
  RepositoryFact,
  RepositoryFinding,
  TeamRole,
  TsStaticHint,
} from "@/server/shared/types";

export type RepositoryFile = {
  content: string;
  path: string;
};

export type ParseTier = "heuristic" | "tree-sitter" | "typescript-ast";

export type FileCategory =
  | "asset"
  | "benchmark"
  | "config"
  | "docs"
  | "generated"
  | "infra"
  | "runtime-source"
  | "test"
  | "tooling";

export type EntrypointKind = "benchmark" | "infra" | "library" | "runtime" | "test" | "tooling";

export type FrameworkCategory =
  | "api"
  | "cloud"
  | "database"
  | "framework"
  | "infrastructure"
  | "orm"
  | "runtime"
  | "testing"
  | "tooling"
  | "ui";

export type FrameworkFact = {
  category: FrameworkCategory;
  confidence: number;
  name: string;
  sources: string[];
};

export type SymbolKind =
  | "class"
  | "const"
  | "enum"
  | "function"
  | "interface"
  | "method"
  | "module"
  | "struct"
  | "trait"
  | "type"
  | "variable";

export type SymbolRef = {
  confidence: number;
  exported: boolean;
  kind: SymbolKind;
  line?: number;
  name: string;
  path: string;
};

export type RouteRef = {
  confidence: number;
  framework?: string;
  kind: "http" | "openapi" | "rpc";
  line?: number;
  method?: string;
  path: string;
  sourcePath: string;
};

export type ConfigRef = {
  confidence: number;
  kind: string;
  path: string;
};

export type EntrypointRef = {
  confidence: number;
  kind: EntrypointKind;
  path: string;
  reason: string;
};

export type DependencyEdge = {
  fromPath: string;
  kind: "external" | "internal";
  resolved: boolean;
  specifier: string;
  toPath?: string;
};

export type ModuleRef = {
  apiSurface: number;
  categories: FileCategory[];
  entrypointHints: EntrypointRef[];
  exports: number;
  frameworkHints: FrameworkFact[];
  imports: string[];
  parseTier: ParseTier;
  path: string;
  routeCount: number;
  symbols: SymbolRef[];
};

export type DependencyGraphEvidence = {
  edges: DependencyEdge[];
  resolvedEdges: number;
  unresolvedImportSpecifiers: number;
  unresolvedSamples: Array<{ fromPath: string; specifier: string }>;
};

export type GraphPreviewEdge = {
  fromPath: string;
  toPath: string;
  weight: number;
};

export type RouteInventory = {
  estimatedOperations: number;
  frameworks: string[];
  httpRoutes: Array<{ method: string; path: string; sourcePath: string }>;
  rpcProcedures: number;
  source: "extracted" | "mixed" | "openapi";
  sourceFiles: string[];
};

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

export type HotspotSignal = {
  categories: FileCategory[];
  churnScore: number;
  complexity: number;
  inbound: number;
  outbound: number;
  path: string;
  score: number;
};

export type ChangeCouplingRef = {
  commits: number;
  fromPath: string;
  toPath: string;
};

export type FileCategoryBreakdownItem = {
  category: FileCategory;
  count: number;
};

export type LanguageMetric = {
  color: string;
  lines: number;
  name: string;
};

export type TechCategory =
  | "CI/CD"
  | "Cloud"
  | "Database"
  | "Framework"
  | "Infrastructure"
  | "Language"
  | "Library"
  | "Mobile"
  | "ORM"
  | "Testing"
  | "UI/Styling";

export interface TechFact {
  category: TechCategory;
  confidence: number;
  name: string;
}

export type RiskSignalKind =
  | "change-coupling"
  | "dependency-cycle"
  | "graph-reliability"
  | "hotspot"
  | "orphan-module";

export type RiskRawMetrics = {
  changeCouplingPairs: number;
  dependencyCycleGroups: number;
  hotspotCount: number;
  orphanModuleCount: number;
  resolvedEdges: number;
  strongestChangeCouplingCommits: number;
  strongestHotspotScore: number;
  unresolvedInternalImports: number;
};

export type RiskDerivedScores = {
  changeCouplingRisk: number;
  dependencyCycleRisk: number;
  graphReliabilityRisk: number;
  hotspotRisk: number;
  orphanModuleRisk: number;
  overallRisk: number;
};

export type RiskFindingRef = {
  category: RepositoryFinding["category"];
  confidence: number;
  evidence: Array<{ note?: string; path: string }>;
  id: string;
  score: number;
  severity: RepositoryFinding["severity"];
  signal: RiskSignalKind;
  suggestedNextChange: string;
  summary: string;
  title: string;
  whyItMatters: string;
};

export type RepositoryEvidence = {
  configs: ConfigRef[];
  dependencyCycles: string[][];
  dependencyGraph: DependencyGraphEvidence;
  entrypoints: EntrypointRef[];
  fileCategoryBreakdown: FileCategoryBreakdownItem[];
  frameworkFacts: FrameworkFact[];
  hotspotSignals: HotspotSignal[];
  modules: ModuleRef[];
  orphanModules: string[];
  publicSurface: SymbolRef[];
  routeInventory: RouteInventory;
  routes: RouteRef[];
  symbols: SymbolRef[];
};

// Section-first documentation model contracts.
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

// Metrics, compatibility, and artifact assembly contracts.
export type FileComplexity = {
  path: string;
  score: number;
};

export type StructuralSignals = {
  apiSurface: number;
  configInventory: string[];
  dependencyCycles: string[][];
  dependencyHotspots: DependencyNodeMetric[];
  entrypointDetails: EntrypointRef[];
  entrypoints: string[];
  fileCategoryBreakdown: FileCategoryBreakdownItem[];
  frameworkFacts: FrameworkFact[];
  graphPreviewEdges: GraphPreviewEdge[];
  graphReliability: GraphReliability;
  hotspotFiles: string[];
  hotspotSignals: HotspotSignal[];
  orphanModules: string[];
  publicExports: number;
  routeInventory: RouteInventory;
};

export type FileSignals = {
  analysisMode: "heuristic" | "tree-sitter" | "typescript-ast";
  apiSurface: number;
  categories?: FileCategory[];
  configRefs?: ConfigRef[];
  entrypointHint: boolean;
  entrypointRefs?: EntrypointRef[];
  exports: number;
  frameworkHints?: FrameworkFact[];
  imports: string[];
  routes?: RouteRef[];
  symbols?: SymbolRef[];
};

export type HealthScoreParams = {
  busFactor: number;
  complexityScore: number;
  dependencyCycles: number;
  docDensity: number;
  duplicationPercentage: number;
  repo: Repo;
  securityScore: number;
  techDebtScore: number;
};

export type SecretLintMessage = {
  line?: number;
  message: string;
  severity: string;
};

export type SecurityFindingMetric = {
  line?: number;
  message: string;
  path: string;
  severity: "error" | "warning";
};

export type RepoMetrics = {
  analysisCoverage: AnalysisCoverage;
  apiSurface: number;
  busFactor: number;
  changeCoupling?: ChangeCouplingRef[];
  churnHotspots?: ChurnHotspot[];
  complexityScore: number;
  configFiles: number;
  configInventory: string[];
  dependencyCycles: string[][];
  dependencyHotspots: DependencyNodeMetric[];
  docDensity: number;
  documentationInput?: DocumentationInputModel;
  duplicationPercentage: number;
  entrypointDetails?: EntrypointRef[];
  entrypoints: string[];
  factCount: number;
  fileCategoryBreakdown?: FileCategoryBreakdownItem[];
  fileCount: number;
  findingCount: number;
  frameworkFacts?: FrameworkFact[];
  graphPreviewEdges?: GraphPreviewEdge[];
  graphReliability?: GraphReliability;
  healthScore: number;
  hotspotFiles: string[];
  hotspotSignals?: HotspotSignal[];
  languages: LanguageMetric[];
  maintenanceStatus: "active" | "dead" | "stale";
  modularityIndex: number;
  mostComplexFiles: string[];
  onboardingScore: number;
  openapiInventory?: OpenApiInventory;
  orphanModules: string[];
  publicExports: number;
  routeInventory?: RouteInventory;
  securityFindings: SecurityFindingMetric[];
  securityScanStatus: "ok" | "partial";
  securityScore: number;
  teamRoles: TeamRole[];
  techDebtScore: number;
  techStack: string[];
  totalLoc: number;
  totalSizeKb: number;
  tsStaticHints?: TsStaticHint[];
};

export type ArtifactBuildParams = {
  busFactor: number;
  evidence: RepositoryEvidence;
  metrics: {
    analysisCoverage: AnalysisCoverage;
    apiSurface: number;
    changeCoupling?: ChangeCouplingRef[];
    churnHotspots?: ChurnHotspot[];
    complexityScore: number;
    configFiles: number;
    configInventory: string[];
    dependencyCycles: string[][];
    docDensity: number;
    duplicationPercentage: number;
    entrypointDetails?: EntrypointRef[];
    entrypoints: string[];
    fileCategoryBreakdown?: FileCategoryBreakdownItem[];
    fileCount: number;
    frameworkFacts?: FrameworkFact[];
    graphPreviewEdges?: GraphPreviewEdge[];
    graphReliability?: GraphReliability;
    hotspotFiles: string[];
    hotspotSignals?: HotspotSignal[];
    languages: { name: string }[];
    mostComplexFiles: string[];
    openapiInventory?: OpenApiInventory;
    orphanModules: string[];
    publicExports: number;
    routeInventory?: RouteInventory;
    securityFindings: Array<{
      line?: number;
      message: string;
      path: string;
      severity: "error" | "warning";
    }>;
    securityScanStatus: "ok" | "partial";
    totalLoc: number;
    tsStaticHints?: TsStaticHint[];
  };
  teamRoles: TeamRole[];
};

export type ArtifactBuildResult = {
  facts: RepositoryFact[];
  findings: RepositoryFinding[];
};
