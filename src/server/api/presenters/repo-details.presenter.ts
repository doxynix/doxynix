import { DocType, type Prisma } from "@prisma/client";

import { aiSchema, type AIResult } from "@/server/ai/schemas";
import type { RepoMetrics } from "@/server/ai/types";

type WriterStatus = "failed" | "fallback" | "llm" | "missing";

export type RepoWithLatestAnalysisAndDocs = Prisma.RepoGetPayload<{
  select: {
    analyses: {
      orderBy: {
        createdAt: "desc";
      };
      select: {
        complexityScore: true;
        createdAt: true;
        metricsJson: true;
        onboardingScore: true;
        resultJson: true;
        score: true;
        securityScore: true;
        status: true;
        techDebtScore: true;
      };
      take: 1;
      where: {
        status: "DONE";
      };
    };
    defaultBranch: true;
    description: true;
    documents: {
      select: {
        createdAt: true;
        publicId: true;
        type: true;
        updatedAt: true;
        version: true;
      };
    };
    forks: true;
    language: true;
    license: true;
    name: true;
    openIssues: true;
    owner: true;
    ownerAvatarUrl: true;
    publicId: true;
    pushedAt: true;
    size: true;
    stars: true;
    topics: true;
    url: true;
    visibility: true;
  };
}>;

export type LatestCompletedAnalysis = Prisma.AnalysisGetPayload<{
  select: {
    complexityScore: true;
    metricsJson: true;
    onboardingScore: true;
    resultJson: true;
    score: true;
    securityScore: true;
    techDebtScore: true;
  };
}>;

type StoredDocument = RepoWithLatestAnalysisAndDocs["documents"][number];

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

function hasText(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function coerceAnalysisPayload(analysis: LatestCompletedAnalysis | undefined | null) {
  if (analysis == null || analysis.metricsJson == null || analysis.resultJson == null) return null;

  const parsed = aiSchema.safeParse(analysis.resultJson);
  if (!parsed.success) return null;

  return {
    aiResult: parsed.data,
    analysis,
    metrics: analysis.metricsJson as RepoMetrics,
  };
}

function dedupeLatestDocsByType(docs: StoredDocument[]) {
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

function getWriterStatus(docType: DocType, aiResult: AIResult | null): WriterStatus | null {
  const writerKey = WRITER_KEY_BY_DOC_TYPE[docType];
  if (writerKey == null) return null;
  return aiResult?.analysisRuntime?.writers?.[writerKey] ?? null;
}

function normalizeWriterStatuses(aiResult: AIResult | null) {
  return {
    api: getWriterStatus(DocType.API, aiResult),
    architecture: getWriterStatus(DocType.ARCHITECTURE, aiResult),
    changelog: getWriterStatus(DocType.CHANGELOG, aiResult),
    contributing: getWriterStatus(DocType.CONTRIBUTING, aiResult),
    readme: getWriterStatus(DocType.README, aiResult),
  };
}

function toDocSummary(doc: StoredDocument, aiResult: AIResult | null) {
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

export const repoDetailsPresenter = {
  toAvailableDocs(repo: Pick<RepoWithLatestAnalysisAndDocs, "analyses" | "documents">) {
    const latestAnalysis = coerceAnalysisPayload(repo.analyses[0]);
    return dedupeLatestDocsByType(repo.documents).map((doc) =>
      toDocSummary(doc, latestAnalysis?.aiResult ?? null)
    );
  },

  toDetailedMetrics(analysis: LatestCompletedAnalysis | null) {
    const payload = coerceAnalysisPayload(analysis);
    if (payload == null) return null;

    const { aiResult, metrics } = payload;
    const findings = aiResult.findings ?? [];
    const facts = aiResult.repository_facts ?? [];

    return {
      architecture: {
        analysisCoverage: metrics.analysisCoverage,
        configInventory: metrics.configInventory,
        dependencyCycles: metrics.dependencyCycles,
        dependencyHotspots: metrics.dependencyHotspots,
        entrypoints: metrics.entrypoints,
        graphReliability: metrics.graphReliability ?? null,
        hotspotFiles: metrics.hotspotFiles,
        orphanModules: metrics.orphanModules,
        routeInventory: metrics.routeInventory ?? null,
      },
      onboarding: {
        guide: aiResult.onboarding_guide,
        score: metrics.onboardingScore,
        teamRoles: metrics.teamRoles,
      },
      quality: {
        analysisCoverage: metrics.analysisCoverage,
        busFactor: metrics.busFactor,
        complexity: metrics.complexityScore,
        dependencyCycles: metrics.dependencyCycles.length,
        docDensity: metrics.docDensity,
        duplicationPercentage: metrics.duplicationPercentage,
        health: metrics.healthScore,
        modularity: metrics.modularityIndex,
        security: metrics.securityScore,
        techDebt: metrics.techDebtScore,
      },
      recommendations: {
        bottlenecks: aiResult.mainBottlenecks ?? [],
        performance: aiResult.sections.performance,
        refactoringTargets: aiResult.refactoring_targets,
        techDebt: aiResult.sections.tech_debt,
      },
      reference: {
        apiStructure: aiResult.sections.api_structure,
        dataFlow: aiResult.sections.data_flow,
        swagger: aiResult.swaggerYaml ?? null,
      },
      risks: {
        facts,
        findings,
        hotspotFiles: metrics.hotspotFiles,
        topRisks: findings.slice(0, 5),
      },
      security: {
        findings: metrics.securityFindings,
        risks: aiResult.sections.security_audit.risks,
        score: aiResult.sections.security_audit.score,
        securityScanStatus: metrics.securityScanStatus,
        vulnerabilities: aiResult.vulnerabilities ?? [],
      },
    };
  },

  toOverview(repo: RepoWithLatestAnalysisAndDocs) {
    const payload = coerceAnalysisPayload(repo.analyses[0]);
    if (payload == null) return null;

    const { aiResult, metrics } = payload;
    const docs = this.toAvailableDocs(repo);

    return {
      docs: {
        availableCount: docs.length,
        availableTypes: docs.map((doc) => doc.type),
        hasSwagger: hasText(aiResult.swaggerYaml),
        items: docs,
        writers: normalizeWriterStatuses(aiResult),
      },
      languages: metrics.languages,
      maintenance: metrics.maintenanceStatus,
      mostComplexFiles: metrics.mostComplexFiles,
      repo: {
        defaultBranch: repo.defaultBranch,
        description: repo.description,
        forks: repo.forks,
        id: repo.publicId,
        language: repo.language,
        license: repo.license,
        name: repo.name,
        openIssues: repo.openIssues,
        owner: repo.owner,
        ownerAvatarUrl: repo.ownerAvatarUrl,
        pushedAt: repo.pushedAt,
        size: repo.size,
        stars: repo.stars,
        topics: repo.topics,
        url: repo.url,
        visibility: repo.visibility,
      },
      scores: {
        complexity: metrics.complexityScore,
        health: metrics.healthScore,
        onboarding: metrics.onboardingScore,
        security: metrics.securityScore,
        techDebt: metrics.techDebtScore,
      },
      signals: {
        analysisCoverage: metrics.analysisCoverage,
        apiSurface: metrics.apiSurface,
        busFactor: metrics.busFactor,
        dependencyCycles: metrics.dependencyCycles.length,
        docDensity: metrics.docDensity,
        duplicationPercentage: metrics.duplicationPercentage,
      },
      stats: {
        configFiles: metrics.configFiles,
        fileCount: metrics.fileCount,
        linesOfCode: metrics.totalLoc,
        totalSizeKb: metrics.totalSizeKb,
        totalSizeLabel: `${metrics.totalSizeKb} KB`,
      },
      summary: aiResult.executive_summary,
      teamRoles: metrics.teamRoles,
      topRisks: (aiResult.findings ?? []).slice(0, 3),
    };
  },
};
