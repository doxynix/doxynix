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

import type {
  ChangeCouplingRef,
  EntrypointRef,
  FileCategoryBreakdownItem,
  FrameworkFact,
  GraphPreviewEdge,
  HotspotSignal,
  LanguageMetric,
  RepositoryEvidence,
  RouteInventory,
  SecurityFindingMetric,
} from "./discovery.types";
import type { DocumentationInputModel } from "./documentation.types";

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
