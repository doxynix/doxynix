import type { AnalysisRefView } from "@doxynix/shared";

import type { AnalysisCoverage } from "../engine/core/discovery.types";

/** Payloads the workspace and node-inspector screens read. */
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
