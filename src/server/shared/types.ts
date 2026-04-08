// TODO: тоже разгребсти типы по возможности

export type TeamRole = {
  login: string;
  role: string;
  share: number;
};

export type AnalysisCoverage = {
  heuristicFiles: number;
  languagesByMode: {
    heuristic: string[];
    treeSitter: string[];
    typeScriptAst: string[];
  };
  parserCoveragePercent: number;
  totalFiles: number;
  treeSitterFiles: number;
  typeScriptAstFiles: number;
};

export type EvidenceRef = {
  line?: number;
  note?: string;
  path: string;
};

export type RepositoryFact = {
  category:
    | "api"
    | "architecture"
    | "configuration"
    | "delivery"
    | "ownership"
    | "quality"
    | "security";
  confidence: "high" | "low" | "medium";
  detail: string;
  evidence: EvidenceRef[];
  id: string;
  title: string;
};

export type RepositoryFinding = {
  category:
    | "architecture"
    | "change-risk"
    | "hotspot"
    | "maintainability"
    | "onboarding"
    | "security";
  confidence: number;
  evidence: EvidenceRef[];
  id: string;
  score: number;
  severity: "CRITICAL" | "HIGH" | "LOW" | "MODERATE";
  suggestedNextChange: string;
  summary: string;
  title: string;
  whyItMatters: string;
};

export type DependencyNodeMetric = {
  exports: number;
  inbound: number;
  outbound: number;
  path: string;
};

export type GraphReliability = {
  resolvedEdges: number;
  unresolvedImportSpecifiers: number;
  unresolvedSamples: Array<{ fromPath: string; specifier: string }>;
};

export type OpenApiInventory = {
  estimatedOperations: number;
  pathPatterns: string[];
  sourceFiles: string[];
};

export type TsStaticHint = {
  detail: string;
  kind: "explicit-any" | "long-function" | "many-params";
  line?: number;
  path: string;
};

export type ChurnHotspot = {
  churnScore: number;
  commitsInWindow: number;
  path: string;
};

export type AnalysisRefView = {
  analysisId: string;
  commitSha: string | null;
  createdAt: Date;
};

export type InteractiveBriefActionAvailability = {
  canDocumentFile: boolean;
  canDrillDeeper: boolean;
  canOpenFileContext: boolean;
  canQuickAudit: boolean;
};

export type InteractiveBriefCapabilities = {
  canDocumentFile: boolean;
  canDrillDown: boolean;
  canExplainNodes: boolean;
  canHighlightFiles: boolean;
  canQuickAudit: boolean;
};

export type InteractiveBriefDocsSummary = {
  availableCount: number;
  availableTypes: string[];
  hasSwagger: boolean;
};

export type InteractiveBriefPanel = {
  availableActions: InteractiveBriefActionAvailability;
  breadcrumbs: Array<{ id: string; label: string; path: string }>;
  drilldownPreview: {
    childCount: number;
    childLabels: string[];
    edgeCount: number;
  };
  explain: {
    confidence: "high" | "low" | "medium";
    nextSuggestedPaths: string[];
    relationships: {
      apiHints: string[];
      apiSurface: boolean;
      breadcrumbs: Array<{ id: string; label: string; path: string }>;
      contains: string[];
      dependsOn: string[];
      entrypoint: boolean;
      entrypointReason: string | null;
      factTitles: string[];
      frameworkHints: string[];
      gitHints: string[];
      graphHints: string[];
      hotspotHints: string[];
      neighborBuckets: Record<string, string[]> | null;
      neighborPaths: string[];
      recommendedActions: string[];
      relatedPaths: string[];
      reviewPriority: { level: "high" | "low" | "medium"; reason: string } | null;
      riskTitles: string[];
      usedBy: string[];
    };
    role: string;
    sourcePaths: string[];
    summary: string[];
    whyImportant: string;
  };
  inspect: {
    apiHints: string[];
    configHints: string[];
    contains: string[];
    dependsOn: string[];
    entrypointReason: string | null;
    factTitles: string[];
    frameworkHints: string[];
    gitHints: string[];
    graphHints: string[];
    hotspotHints: string[];
    kind: string;
    neighborBuckets: Record<string, string[]> | null;
    neighborPaths: string[];
    nextSuggestedPaths: string[];
    recommendedActions: string[];
    relatedPaths: string[];
    reviewPriority: { level: "high" | "low" | "medium"; reason: string } | null;
    samplePaths: string[];
    title: string;
    usedBy: string[];
    whyImportant: string;
  };
  node: {
    canDrillDeeper: boolean;
    description: string;
    id: string;
    kind: string;
    label: string;
    markers: {
      api: boolean;
      client: boolean;
      config: boolean;
      entrypoint: boolean;
      risk: boolean;
      server: boolean;
      shared: boolean;
    };
    nodeType: "file" | "group";
    path: string;
    previewPaths: string[];
    score: number;
    stats: {
      apiCount: number;
      changeCouplingCount: number;
      churnCount: number;
      configCount: number;
      dependencyHotspotCount: number;
      entrypointCount: number;
      frameworkCount: number;
      graphWarningCount: number;
      hotspotCount: number;
      orphanCount: number;
      pathCount: number;
      riskCount: number;
    };
  };
};

export type InteractiveBriefPayload = {
  analysisRef: AnalysisRefView | null;
  capabilities: InteractiveBriefCapabilities;
  docsSummary: InteractiveBriefDocsSummary;
  overview: {
    architectureStyle: string | null;
    primaryEntrypoints: string[];
    primaryModules: string[];
    purpose: string;
    repositoryKind: string;
    stack: string[];
  };
  panel: {
    defaultNode: InteractiveBriefPanel | null;
  };
  selection: {
    defaultNodeId: string | null;
  };
  structure: {
    edges: Array<{
      id: string;
      relation: string;
      source: string;
      target: string;
      weight: number;
    }>;
    groups: Array<{
      description: string;
      id: string;
      label: string;
    }>;
    nodes: InteractiveBriefPanel["node"][];
  };
};

export type InteractiveBriefNodePayload = {
  analysisRef: AnalysisRefView | null;
  availableActions: InteractiveBriefActionAvailability;
  breadcrumbs: InteractiveBriefPanel["breadcrumbs"];
  canDrillDeeper: boolean;
  children: InteractiveBriefPanel["node"][];
  edges: InteractiveBriefPayload["structure"]["edges"];
  explain: InteractiveBriefPanel["explain"];
  inspect: InteractiveBriefPanel["inspect"];
  node: InteractiveBriefPanel["node"];
};

export type FileActionPreviewResult = {
  action: "document-file-preview" | "quick-file-audit";
  analysisRef: AnalysisRefView | null;
  confidence: "high" | "low" | "medium";
  consistency: "matched" | "mismatch" | "unknown";
  consistencyNote: string | null;
  content: string;
  contextDiagnostics: {
    contextStrength: "light" | "moderate" | "none" | "strong";
    graphNeighborCount: number;
    hasContext: boolean;
    neighborPathCount: number;
    nextSuggestedPathCount: number;
    nonEmptyBuckets: string[];
    recommendedActionCount: number;
    sourcePathCount: number;
  };
  contextMeta: {
    confidence: "high" | "low" | "medium" | null;
    graphBacked: boolean;
    mode: "node" | "none";
    nodeId: string | null;
    source: "node-explain" | "none";
    title: string | null;
  };
  path: string;
  summary: string;
  title: string;
};
