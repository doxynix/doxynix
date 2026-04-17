import type {
  DependencyNodeMetric,
  GraphReliability,
  RepositoryFinding,
} from "@/server/shared/types";

export type ParseTier = "heuristic" | "tree-sitter" | "typescript-ast";

export type RepositoryFile = {
  content: string;
  path: string;
};

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

export type FileCategoryBreakdownItem = {
  category: FileCategory;
  count: number;
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

export type ChangeCouplingRef = {
  commits: number;
  fromPath: string;
  toPath: string;
};

export interface BaseSignal {
  confidence: number;
  path: string;
  score?: number;
  source: "analysis" | "extraction" | "risk-model";
}

export interface FileSignals extends BaseSignal {
  analysisMode: ParseTier;
  apiSurface: number;
  categories?: FileCategory[];
  configRefs?: ConfigRef[];
  entrypointHint: boolean;
  entrypointRefs?: EntrypointRef[];
  exports: number;
  frameworkHints?: FrameworkFact[];
  imports: string[];
  routes?: RouteRef[];
  source: "extraction";
  symbols?: SymbolRef[];
}

export interface HotspotSignal extends BaseSignal {
  categories: FileCategory[];
  churnScore: number;
  complexity: number;
  inbound: number;
  outbound: number;
  score: number;
  source: "risk-model";
}

export interface SecuritySignal extends BaseSignal {
  line?: number;
  message: string;
  severity: "error" | "warning";
  source: "analysis";
}

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

export interface GraphEvidence {
  dependencyCycles: string[][];
  dependencyGraph: DependencyGraphEvidence;
  orphanModules: string[];
}

export interface ModuleEvidence {
  fileCategoryBreakdown: FileCategoryBreakdownItem[];
  frameworkFacts: FrameworkFact[];
  hotspotSignals: HotspotSignal[];
  modules: ModuleRef[];
  publicSurface: SymbolRef[];
  symbols: SymbolRef[];
}

export interface SecurityEvidence {
  configs: ConfigRef[];
}

export interface RouteEvidence {
  routeInventory: RouteInventory;
  routes: RouteRef[];
}

export interface RepositoryEvidenceComposite {
  graph: GraphEvidence;
  modules: ModuleEvidence;
  routes: RouteEvidence;
  security: SecurityEvidence;
}

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

export type FileComplexity = {
  path: string;
  score: number;
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

export type TechFact = {
  category: TechCategory;
  confidence: number;
  name: string;
};

export type Module = {
  apiSurface?: number;
  approxLines?: number;
  categories?: FileCategory[];
  content?: string;
  entrypointHints?: EntrypointRef[];
  exports?: number;
  frameworkHints?: FrameworkFact[];
  head?: string;
  imports?: string[];
  isApiHeuristic?: boolean;
  isConfig?: boolean;
  linguistLabel?: string;
  parseTier?: ParseTier;
  path: string;
  roleHint?: string;
  routeCount?: number;
  symbols?: SymbolRef[];
};
