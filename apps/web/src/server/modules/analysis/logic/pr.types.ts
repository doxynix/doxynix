import type { PRCommentStyle, PRFocusArea } from "@doxynix/shared";

export type PRFinding = {
  codeSnippet?: string;
  file: string;
  line: number;
  message: string;
  score: number;
  severity: "CRITICAL" | "HIGH" | "LOW" | "MEDIUM";
  suggestion?: string;
  title: string;
  type: "ARCHITECTURE" | "BUG" | "COMPLEXITY" | "PERFORMANCE" | "SECURITY" | "STYLE";
};

export type DifferentialAnalysisResult = {
  analyzedLines: number;
  changedFiles: number;
  findings: PRFinding[];
  riskScore: number; // 0-10
  summary: string;
  totalDuration: number; // ms
};

export type PRAnalysisConfig = {
  ciSkip: boolean;
  commentStyle: PRCommentStyle;
  enabled: boolean;
  excludePatterns: string[];
  focusAreas: PRFocusArea[];
  tokenBudget: number;
};

// PRIVACY: the diff is never stored in the DB — generated on demand, sent to the frontend and back to applyFix
export type FindingForFix = {
  file: string;
  line: number;
  suggestion?: string;
  type: string;
};

export type GeneratedDiff = {
  additions: number;
  deletions: number;
  filePath: string;
  patch: string;
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
