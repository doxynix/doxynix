import type { PRAnalysisStatus } from "@doxynix/shared";

import type { PRNumber } from "@/entities/pr/model/pr.types";

export type PrDetailItem =
  | { kind: "copy"; label: string; value: string }
  | { kind: "number"; label: string; value: number }
  | { kind: "status"; label: string; value: PRAnalysisStatus | undefined }
  | { kind: "time"; label: string; value: Date | null };

export type PrDetailLabels = {
  affectedZones: string;
  baseSha: string;
  changedFiles: string;
  created: string;
  status: string;
};

export type ImpactStat = {
  label: string;
  value: number | string;
};

export type ImpactStatLabels = {
  findings: string;
  fixes: string;
  generatedFixes: string;
  nodes: string;
  primaryView: string;
  primaryViewFallback: string;
  totalIssues: string;
};

type DetailInput = {
  analysis: PRNumber | undefined;
  impact: PRNumber | undefined;
  labels: PrDetailLabels;
};

export function buildPrDetailItems({ analysis, impact, labels }: DetailInput): PrDetailItem[] {
  return [
    { kind: "copy", label: labels.baseSha, value: analysis?.analysis.baseSha ?? "" },
    { kind: "status", label: labels.status, value: analysis?.analysis.status },
    { kind: "number", label: labels.changedFiles, value: impact?.summary.affectedFiles ?? 0 },
    { kind: "number", label: labels.affectedZones, value: impact?.summary.affectedZones ?? 0 },
    { kind: "time", label: labels.created, value: analysis?.analysis.createdAt ?? null },
  ];
}

type ImpactInput = {
  commentsCount: number;
  fixesCount: number;
  impact: PRNumber | undefined;
  labels: ImpactStatLabels;
};

export function buildImpactStats({
  commentsCount,
  fixesCount,
  impact,
  labels,
}: ImpactInput): ImpactStat[] {
  return [
    { label: labels.nodes, value: impact?.summary.affectedNodes ?? 0 },
    { label: labels.findings, value: impact?.summary.findings ?? 0 },
    { label: labels.fixes, value: impact?.summary.linkedFixes ?? 0 },
    {
      label: labels.primaryView,
      value: impact?.navigationHints.recommendedView ?? labels.primaryViewFallback,
    },
    { label: labels.totalIssues, value: commentsCount },
    { label: labels.generatedFixes, value: fixesCount },
  ];
}

type CommentInput = {
  bodyHtml: string;
  filePath: string;
  findingType: string;
  line: number;
};

export type FixFinding = {
  file: string;
  line: number;
  suggestion: string;
  type: string;
};

export const toFixFinding = (comment: CommentInput): FixFinding => ({
  file: comment.filePath,
  line: comment.line,
  suggestion: comment.bodyHtml,
  type: comment.findingType.toLowerCase(),
});
