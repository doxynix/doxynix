import { unstable_cache } from "next/cache";
import type { DocType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { highlightCode } from "@/shared/lib/shiki";

import { aiSchema, type AIResult } from "@/server/ai/schemas";
import type { RepoMetrics } from "@/server/ai/types";
import type { DbClient } from "@/server/infrastructure/db";
import { markdownToHtml } from "@/server/utils/markdown-to-html";

export const repoDetailsService = {
  async getAvailableDocs(db: DbClient, repoId: string) {
    const docs = await db.document.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        publicId: true,
        type: true,
      },
      where: { repo: { publicId: repoId } },
    });
    return docs.map((d) => ({
      id: d.publicId,
      type: d.type,
    }));
  },

  async getDetailedMetrics(db: DbClient, repoId: string) {
    const analysis = await db.analysis.findFirst({
      orderBy: { createdAt: "desc" },
      where: { repo: { publicId: repoId }, status: "DONE" },
    });

    if (analysis == null || analysis.resultJson == null || analysis.metricsJson == null)
      return null;

    const res = aiSchema.parse(analysis.resultJson);
    const metrics = analysis.metricsJson as RepoMetrics;
    const findings = res.findings ?? [];

    return {
      apiStructure: res.sections.api_structure,
      bottlenecks: res.mainBottlenecks ?? [],
      dataFlow: res.sections.data_flow,
      facts: res.repository_facts ?? [],
      findings,
      onboarding: res.onboarding_guide,
      performance: res.sections.performance,
      refactoringTargets: res.refactoring_targets,
      scorecard: {
        analysisCoverage: metrics.analysisCoverage,
        apiSurface: metrics.apiSurface,
        busFactor: metrics.busFactor,
        dependencyCycles: metrics.dependencyCycles.length,
        docDensity: metrics.docDensity,
        duplicationPercentage: metrics.duplicationPercentage,
        healthScore: analysis.score,
        modularityScore: metrics.modularityIndex,
        securityScore: analysis.securityScore,
      },
      security: {
        findings: metrics.securityFindings,
        risks: res.sections.security_audit.risks,
        score: res.sections.security_audit.score,
        vulnerabilities: res.vulnerabilities ?? [],
      },
      structure: {
        analysisCoverage: metrics.analysisCoverage,
        configInventory: metrics.configInventory,
        dependencyHotspots: metrics.dependencyHotspots,
        entrypoints: metrics.entrypoints,
        hotspotFiles: metrics.hotspotFiles,
        orphanModules: metrics.orphanModules,
        teamRoles: metrics.teamRoles,
      },
      swagger: res.swaggerYaml,
      techDebt: res.sections.tech_debt,
      topRisks: findings,
    };
  },

  async getDocumentContent(db: DbClient, repoId: string, type: DocType) {
    const doc = await db.document.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        repo: { publicId: repoId },
        type,
      },
    });

    if (doc == null) throw new TRPCError({ code: "NOT_FOUND" });

    const html = await unstable_cache(
      async () => markdownToHtml(doc.content),
      [`doc-html-${doc.publicId}`],
      {
        revalidate: false,
        tags: ["docs", doc.publicId],
      }
    )();

    return { html, id: doc.publicId };
  },

  async getHistory(db: DbClient, repoId: string) {
    const history = await db.analysis.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        commitSha: true,
        createdAt: true,
        message: true,
        publicId: true,
        score: true,
        status: true,
      },
      where: { repo: { publicId: repoId } },
    });

    return history.map((h) => ({
      commitSha: h.commitSha,
      createdAt: h.createdAt,
      id: h.publicId,
      message: h.message,
      score: h.score,
      status: h.status,
    }));
  },

  async getOverview(db: DbClient, repoId: string) {
    const repo = await db.repo.findUnique({
      include: {
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          where: { status: "DONE" },
        },
      },
      where: { publicId: repoId },
    });

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });

    const lastAnalysis = repo.analyses[0];
    if (lastAnalysis.resultJson == null || lastAnalysis.metricsJson == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Analysis data is missing" });
    }

    const metrics = lastAnalysis.metricsJson as RepoMetrics;
    const result = lastAnalysis.resultJson as AIResult;

    return {
      description: repo.description,
      facts: (result.repository_facts ?? []).slice(0, 4),
      languages: metrics.languages,
      maintenance: metrics.maintenanceStatus,
      mostComplexFiles:
        metrics.hotspotFiles.length > 0 ? metrics.hotspotFiles : metrics.mostComplexFiles,
      name: repo.name,
      owner: repo.owner,
      scores: {
        analysisCoverage: metrics.analysisCoverage,
        apiSurface: metrics.apiSurface,
        busFactor: metrics.busFactor,
        complexityScore: metrics.complexityScore,
        dependencyCycles: metrics.dependencyCycles.length,
        docDensity: metrics.docDensity,
        duplicationPercentage: metrics.duplicationPercentage,
        healthScore: lastAnalysis.score,
        onboardingScore: lastAnalysis.onboardingScore,
        securityScore: lastAnalysis.securityScore,
        techDebtScore: lastAnalysis.techDebtScore,
      },
      stats: {
        configFiles: metrics.configFiles,
        fileCount: metrics.fileCount,
        linesOfCode: metrics.totalLoc,
        totalSize: `${metrics.totalSizeKb} KB`,
      },
      summary: result.executive_summary,
      teamRoles: metrics.teamRoles,
      topRisks: (result.findings ?? []).slice(0, 3),
    };
  },

  async highlightFile(content: string, path: string) {
    const ext = path.split(".").pop() ?? "txt";
    const html = await highlightCode(content, ext);
    return { html };
  },
};
