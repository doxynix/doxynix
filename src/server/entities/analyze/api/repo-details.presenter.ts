import type {
  LatestCompletedAnalysis,
  RepoWithLatestAnalysisAndDocs,
} from "@/server/shared/infrastructure/repo-snapshots";
import { hasText } from "@/server/shared/lib/string-utils";

import { buildStructureMapPayload, buildStructureNodePayload } from "../lib/graph-navigator";
import { buildNodeExplainPayload } from "../lib/node-explainer";
import {
  coerceAnalysisPayload,
  dedupeLatestDocsByType,
  normalizeWriterStatuses,
  toDocSummary,
} from "../lib/payload";

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

  toNodeExplain(repo: RepoWithLatestAnalysisAndDocs, nodeId: string) {
    return buildNodeExplainPayload(repo, nodeId);
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

  toStructureMap(repo: RepoWithLatestAnalysisAndDocs) {
    return buildStructureMapPayload(repo);
  },

  toStructureNode(repo: RepoWithLatestAnalysisAndDocs, nodeId: string) {
    return buildStructureNodePayload(repo, nodeId);
  },
};
