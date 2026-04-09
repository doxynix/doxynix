import { DocType } from "@prisma/client";

import { aiSchema, type AIResult } from "@/server/shared/engine/core/analysis-result.schemas";
import type { RepoMetrics } from "@/server/shared/engine/core/metrics.types";
import type { LatestCompletedAnalysis } from "@/server/shared/infrastructure/repo-snapshots";

import type { StoredDocument, WriterStatus } from "./structure-shared";

export function coerceAnalysisPayload(analysis: LatestCompletedAnalysis | undefined | null) {
  if (analysis == null || analysis.metricsJson == null || analysis.resultJson == null) return null;

  const parsed = aiSchema.safeParse(analysis.resultJson);
  if (!parsed.success) return null;

  return {
    aiResult: parsed.data,
    analysis,
    metrics: analysis.metricsJson as unknown as RepoMetrics,
  };
}

export function dedupeLatestDocsByType(docs: StoredDocument[]) {
  const latestByType = new Map<DocType, StoredDocument>();

  for (const doc of docs) {
    const current = latestByType.get(doc.type);
    if (current == null || doc.updatedAt > current.updatedAt) {
      latestByType.set(doc.type, doc);
    }
  }

  return Array.from(latestByType.values()).sort((left, right) => {
    const orderDiff = DOC_TYPE_ORDER[left.type] - DOC_TYPE_ORDER[right.type];
    if (orderDiff !== 0) return orderDiff;
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

export function getWriterStatus(docType: DocType, aiResult: AIResult | null): WriterStatus | null {
  const writerKey = WRITER_KEY_BY_DOC_TYPE[docType];
  if (writerKey == null) return null;
  return aiResult?.analysisRuntime?.writers?.[writerKey] ?? null;
}

export function normalizeWriterStatuses(aiResult: AIResult | null) {
  return {
    api: getWriterStatus(DocType.API, aiResult),
    architecture: getWriterStatus(DocType.ARCHITECTURE, aiResult),
    changelog: getWriterStatus(DocType.CHANGELOG, aiResult),
    contributing: getWriterStatus(DocType.CONTRIBUTING, aiResult),
    readme: getWriterStatus(DocType.README, aiResult),
  };
}

export function toDocSummary(doc: StoredDocument, aiResult: AIResult | null) {
  const status = getWriterStatus(doc.type, aiResult);
  return {
    id: doc.publicId,
    isFallback: status === "fallback",
    source: status === "fallback" ? "fallback" : status === "llm" ? "llm" : null,
    status,
    type: doc.type,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

const DOC_TYPE_ORDER: Record<DocType, number> = {
  [DocType.API]: 2,
  [DocType.ARCHITECTURE]: 1,
  [DocType.CHANGELOG]: 4,
  [DocType.CODE_DOC]: 5,
  [DocType.CONTRIBUTING]: 3,
  [DocType.README]: 0,
};

const WRITER_KEY_BY_DOC_TYPE: Partial<
  Record<DocType, keyof NonNullable<NonNullable<AIResult["analysisRuntime"]>["writers"]>>
> = {
  [DocType.API]: "api",
  [DocType.ARCHITECTURE]: "architecture",
  [DocType.CHANGELOG]: "changelog",
  [DocType.CONTRIBUTING]: "contributing",
  [DocType.README]: "readme",
};
