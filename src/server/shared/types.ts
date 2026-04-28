// TODO: тоже разгрести типы по возможности

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
  commitSha: null | string;
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
      entrypointReason: null | string;
      factTitles: string[];
      frameworkHints: string[];
      gitHints: string[];
      graphHints: string[];
      hotspotHints: string[];
      neighborBuckets: null | Record<string, string[]>;
      neighborPaths: string[];
      recommendedActions: string[];
      relatedPaths: string[];
      reviewPriority: null | { level: "high" | "low" | "medium"; reason: string };
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
    entrypointReason: null | string;
    factTitles: string[];
    frameworkHints: string[];
    gitHints: string[];
    graphHints: string[];
    hotspotHints: string[];
    kind: string;
    neighborBuckets: null | Record<string, string[]>;
    neighborPaths: string[];
    nextSuggestedPaths: string[];
    recommendedActions: string[];
    relatedPaths: string[];
    reviewPriority: null | { level: "high" | "low" | "medium"; reason: string };
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
    architectureStyle: null | string;
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
    defaultNodeId: null | string;
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

export type RepoWorkspacePayload = {
  analysisRef: AnalysisRefView | null;
  docs: InteractiveBriefDocsSummary & {
    items: Array<{
      id: string;
      source: "llm" | null;
      status: "failed" | "llm" | "missing" | null;
      type: string;
      updatedAt: Date;
      version: string;
    }>;
  };
  mostComplexFiles: string[];
  navigation: {
    defaultNodeId: null | string;
    keyZones: InteractiveBriefPayload["structure"]["nodes"];
    primaryEntrypoints: string[];
    primaryModules: string[];
  };
  repo: {
    defaultBranch: string;
    description: null | string;
    forks: number;
    id: string;
    language: null | string;
    languageColor: string;
    license: null | string;
    name: string;
    openIssues: number;
    owner: string;
    ownerAvatarUrl: null | string;
    pushedAt: Date | null;
    size: number;
    stars: number;
    topics: string[];
    url: string;
    visibility: string;
  };
  secondary: {
    languages: Array<{ color: string; lines: number; name: string }>;
    scores: {
      complexity: number;
      health: number;
      onboarding: number;
      security: number;
      techDebt: number;
    };
    signals: {
      analysisCoverage: AnalysisCoverage;
      apiSurface: number;
      busFactor: number;
      dependencyCycles: number;
      docDensity: number;
      duplicationPercentage: number;
    };
    stats: {
      configFiles: number;
      fileCount: number;
      linesOfCode: number;
      totalSizeKb: number;
      totalSizeLabel: string;
    };
  };
  summary: {
    architectureStyle: null | string;
    maintenance: string;
    purpose: string;
    repositoryKind: string;
    stack: string[];
  };
  topRisks: Array<{
    id: string;
    severity: "CRITICAL" | "HIGH" | "LOW" | "MODERATE";
    suggestedNextChange: string;
    summary: string;
    title: string;
  }>;
};

export type RepoNodeContextPayload = {
  analysisRef: AnalysisRefView | null;
  availableActions: InteractiveBriefActionAvailability;
  breadcrumbs: InteractiveBriefPanel["breadcrumbs"];
  canDrillDeeper: boolean;
  children: InteractiveBriefPanel["node"][];
  edges: InteractiveBriefPayload["structure"]["edges"];
  explain: InteractiveBriefPanel["explain"];
  inspect: InteractiveBriefPanel["inspect"];
  node: InteractiveBriefPanel["node"];
  related: {
    docs: Array<{
      docId: string;
      docType: string;
      id: string;
      title: string;
    }>;
    files: string[];
    findings: Array<{
      body: string;
      filePath: string;
      findingType: string;
      id: string;
      line: number;
      prAnalysisId: string;
      prNumber: number;
      riskLevel: number;
    }>;
    fixes: Array<{
      githubPrNumber: null | number;
      githubPrUrl: null | string;
      id: string;
      status: string;
      title: string;
    }>;
  };
};

export type RepoSearchResult = {
  description: string;
  docSectionId: null | string;
  docType: null | string;
  id: string;
  kind: "doc-section" | "entrypoint" | "file" | "node" | "route";
  label: string;
  nodeId: null | string;
  path: null | string;
  score: number;
  targetView: "code" | "docs" | "map";
};

export type PRChangedFileSnapshot = {
  additions: number;
  deletions: number;
  filePath: string;
  previousFilePath: null | string;
  status: "added" | "modified" | "removed" | "renamed";
};

export type PRImpactPayload = {
  affectedNodes: Array<{
    fileCount: number;
    findingCount: number;
    impactScore: number;
    kind: string;
    label: string;
    nodeId: string;
    nodeType: "file" | "group";
    path: string;
    relatedChangedFiles: string[];
    whyAffected: string;
    zoneId: null | string;
  }>;
  affectedZones: Array<{
    fileCount: number;
    findingCount: number;
    impactScore: number;
    kind: string;
    label: string;
    nodeId: string;
    path: string;
    relatedChangedFiles: string[];
  }>;
  analysis: {
    baseSha: string;
    createdAt: Date;
    headSha: string;
    id: string;
    prNumber: number;
    riskScore: null | number;
    status: string;
  };
  changedFiles: Array<
    PRChangedFileSnapshot & {
      findingCount: number;
      nodeId: null | string;
      nodeLabel: null | string;
      targetView: "code" | "map";
      zoneId: null | string;
      zoneLabel: null | string;
    }
  >;
  fixes: Array<{
    githubPrNumber: null | number;
    githubPrUrl: null | string;
    id: string;
    status: string;
    title: string;
  }>;
  navigationHints: {
    primaryFilePath: null | string;
    primaryNodeId: null | string;
    recommendedView: "code" | "docs" | "map";
  };
  summary: {
    affectedFiles: number;
    affectedNodes: number;
    affectedZones: number;
    findings: number;
    linkedFixes: number;
  };
  topFindings: Array<{
    filePath: string;
    findingType: string;
    id: string;
    line: number;
    message: string;
    messageHtml: string;
    nodeId: null | string;
    riskLevel: number;
    title: string;
    zoneId: null | string;
    zoneLabel: null | string;
  }>;
};

export type FileActionPreviewResult = {
  action: "document-file-preview" | "quick-file-audit";
  analysisRef: AnalysisRefView | null;
  confidence: "high" | "low" | "medium";
  consistency: "matched" | "mismatch" | "unknown";
  consistencyNote: null | string;
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
    nodeId: null | string;
    source: "node-explain" | "none";
    title: null | string;
  };
  path: string;
  summary: string;
  title: string;
};
