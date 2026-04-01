import type {
  ChangeCouplingRef,
  DocumentationInputModel,
  EntrypointRef,
  FrameworkFact,
  HotspotSignal,
  RiskDerivedScores,
  RiskFindingRef,
  RiskRawMetrics,
  RouteInventory,
} from "@/server/engine/core/types";
import type {
  AnalysisCoverage as SharedAnalysisCoverage,
  ChurnHotspot as SharedChurnHotspot,
  DependencyNodeMetric as SharedDependencyNodeMetric,
  EvidenceRef as SharedEvidenceRef,
  GraphReliability as SharedGraphReliability,
  OpenApiInventory as SharedOpenApiInventory,
  RepositoryFact as SharedRepositoryFact,
  RepositoryFinding as SharedRepositoryFinding,
  TeamRole as SharedTeamRole,
  TsStaticHint as SharedTsStaticHint,
} from "@/server/shared/types";

export type LanguageMetric = {
  color: string;
  lines: number;
  name: string;
};

export type TeamRole = SharedTeamRole;

export type FileCategoryBreakdownMetric = {
  category:
    | "asset"
    | "benchmark"
    | "config"
    | "docs"
    | "generated"
    | "infra"
    | "runtime-source"
    | "test"
    | "tooling";
  count: number;
};

export type FrameworkMetric = FrameworkFact;
export type EntrypointMetric = EntrypointRef;
export type RouteInventoryMetric = RouteInventory;
export type HotspotSignalMetric = HotspotSignal;
export type ChangeCouplingMetric = ChangeCouplingRef;
export type RiskRawMetricsMetric = RiskRawMetrics;
export type RiskDerivedScoresMetric = RiskDerivedScores;
export type RiskFindingMetric = RiskFindingRef;
export type DocumentationInputMetric = DocumentationInputModel;

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

export type AnalysisCoverage = SharedAnalysisCoverage;
export type EvidenceRef = SharedEvidenceRef;
export type RepositoryFact = SharedRepositoryFact;
export type RepositoryFinding = SharedRepositoryFinding;
export type DependencyNodeMetric = SharedDependencyNodeMetric;

export type SecurityFindingMetric = {
  line?: number;
  message: string;
  path: string;
  severity: "error" | "warning";
};

export type GraphReliability = SharedGraphReliability;
export type OpenApiInventory = SharedOpenApiInventory;
export type TsStaticHint = SharedTsStaticHint;
export type ChurnHotspot = SharedChurnHotspot;

export type RepoMetrics = {
  analysisCoverage: AnalysisCoverage;
  apiSurface: number;
  busFactor: number;
  changeCoupling?: ChangeCouplingMetric[];
  churnHotspots?: ChurnHotspot[];
  complexityScore: number;
  configFiles: number;
  configInventory: string[];
  dependencyCycles: string[][];
  dependencyHotspots: DependencyNodeMetric[];
  docDensity: number;
  documentationInput?: DocumentationInputMetric;
  duplicationPercentage: number;
  entrypointDetails?: EntrypointMetric[];
  entrypoints: string[];
  factCount: number;
  fileCategoryBreakdown?: FileCategoryBreakdownMetric[];
  fileCount: number;
  findingCount: number;
  frameworkFacts?: FrameworkMetric[];
  graphReliability?: GraphReliability;
  healthScore: number;
  hotspotFiles: string[];
  hotspotSignals?: HotspotSignalMetric[];
  languages: LanguageMetric[];
  maintenanceStatus: "active" | "stale" | "dead";
  modularityIndex: number;
  mostComplexFiles: string[];
  onboardingScore: number;
  openapiInventory?: OpenApiInventory;
  orphanModules: string[];
  publicExports: number;
  routeInventory?: RouteInventoryMetric;
  securityFindings: SecurityFindingMetric[];
  securityScore: number;
  teamRoles: TeamRole[];
  techDebtScore: number;
  techStack: string[];
  totalLoc: number;
  totalSizeKb: number;
  tsStaticHints?: TsStaticHint[];
};
