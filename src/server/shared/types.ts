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
