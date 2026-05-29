import { unstable_cache } from "next/cache";
import { sumBy } from "es-toolkit";
import { normalize } from "pathe";
import { z } from "zod";

import { appLogger } from "@/server/core/app-logger";
import { getLanguageColor } from "@/server/utils/language-metadata";
import { markdownToHtml } from "@/server/utils/markdown-to-html";
import { hasText } from "@/server/utils/string-utils";
import type { PRChangedFileSnapshot, PRImpactPayload } from "@/server/utils/types";

import type { LatestCompletedAnalysis, RepoWithLatestAnalysisAndDocs } from "./analysis.repository";
import {
  changedFileSnapshotSchema,
  persistedFindingSchema,
  type ImpactAnalysis,
  type ParsedFinding,
} from "./analysis.schemas";
import { aiSchema, type AIResult } from "./engine/core/analysis-result.schemas";
import type { RepoMetrics } from "./engine/core/metrics.types";
import type { createAnalyzeContextBuilder } from "./logic/analyze-context-builder";
import { dedupeLatestDocsByType, normalizeWriterStatuses, toDocSummary } from "./logic/payload";
import { isPathInsideScope } from "./logic/structure-shared";

type AnalysisRef = {
  analysisId: string;
  commitSha: null | string;
  createdAt: Date;
};

type ExplainPayload = NonNullable<
  ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getNodeExplain"]>
>;

type StructureNodePayload = NonNullable<
  ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getStructureNode"]>
>;

type TopLevelImpactNode = {
  id: string;
  kind: string;
  label: string;
  nodeType: "file" | "group";
  path: string;
};

type AnalysisPayload = {
  aiResult: AIResult;
  analysis: LatestCompletedAnalysis;
  metrics: RepoMetrics;
};

export const analysisMapper = {
  buildAffectedNodes(
    changedFiles: Array<PRImpactPayload["changedFiles"][number]>,
    findings: ParsedFinding[],
    analyzeContext: ReturnType<typeof createAnalyzeContextBuilder>,
    topLevelNodeById: Map<string, TopLevelImpactNode>,
    nodeDetailCache: Map<string, ReturnType<typeof analyzeContext.getStructureNode>>
  ) {
    const grouped = new Map<string, typeof changedFiles>();

    for (const file of changedFiles) {
      if (file.nodeId == null) continue;
      const items = grouped.get(file.nodeId) ?? [];
      items.push(file);
      grouped.set(file.nodeId, items);
    }

    return [...grouped.entries()]
      .map(([nodeId, files]) => {
        const matchedNode = this.resolveMatchedNode(
          nodeId,
          analyzeContext,
          topLevelNodeById,
          nodeDetailCache
        );
        if (matchedNode == null) return null;

        const relatedFindings = findings.filter((finding) =>
          files.some((file) => file.filePath === finding.file)
        );
        const findingCount = relatedFindings.length;
        const impactScore = this.computeImpactScore(
          files,
          findingCount,
          matchedNode.markers ?? {
            api: matchedNode.kind === "api",
            entrypoint: false,
            risk: findingCount > 0,
          }
        );

        return {
          fileCount: files.length,
          findingCount,
          impactScore,
          kind: matchedNode.kind,
          label: matchedNode.label,
          nodeId,
          nodeType: matchedNode.nodeType,
          path: matchedNode.path,
          relatedChangedFiles: files.map((file) => file.filePath),
          whyAffected: `${files.length} changed file(s) and ${findingCount} linked finding(s) touch this node.`,
          zoneId: files[0]?.zoneId ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .toSorted(
        (left, right) =>
          right.impactScore - left.impactScore || left.label.localeCompare(right.label)
      );
  },

  buildAffectedZones(
    changedFiles: Array<PRImpactPayload["changedFiles"][number]>,
    findings: ParsedFinding[],
    zoneNodeById: Map<string, TopLevelImpactNode>
  ) {
    const findingsByFile = this.countFindingsByFile(findings);
    const grouped = new Map<string, typeof changedFiles>();

    for (const file of changedFiles) {
      if (file.zoneId == null) continue;
      const items = grouped.get(file.zoneId) ?? [];
      items.push(file);
      grouped.set(file.zoneId, items);
    }

    return [...grouped.entries()]
      .map(([zoneId, files]) => {
        const zone = zoneNodeById.get(zoneId);
        if (zone == null) return null;

        const findingCount = sumBy(files, (file) => findingsByFile.get(file.filePath) ?? 0);
        return {
          fileCount: files.length,
          findingCount,
          impactScore: this.computeImpactScore(files, findingCount, {
            api: zone.kind === "api",
            entrypoint: false,
            risk: files.some((file) => file.findingCount > 0),
          }),
          kind: zone.kind,
          label: zone.label,
          nodeId: zone.id,
          path: zone.path,
          relatedChangedFiles: files.map((file) => file.filePath),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .toSorted(
        (left, right) =>
          right.impactScore - left.impactScore || left.label.localeCompare(right.label)
      );
  },

  async buildTopFindings(
    findings: ParsedFinding[],
    changedFiles: Array<PRImpactPayload["changedFiles"][number]>,
    zoneNodeById: Map<string, Pick<TopLevelImpactNode, "label">>,
    owner?: string,
    name?: string
  ) {
    const fileByPath = new Map(changedFiles.map((file) => [file.filePath, file] as const));

    const sortedFindings = findings
      .map((finding, index) => {
        const file = fileByPath.get(finding.file);
        return {
          filePath: finding.file,
          findingType: finding.type,
          id: `${finding.file}:${finding.line}:${finding.type}:${index}`,
          line: finding.line,
          message: finding.message,
          nodeId: file?.nodeId ?? null,
          riskLevel: finding.score ?? 0,
          title: finding.title,
          zoneId: file?.zoneId ?? null,
          zoneLabel:
            file?.zoneId == null ? null : (zoneNodeById.get(file.zoneId)?.label ?? file.zoneLabel),
        };
      })
      .toSorted(
        (left, right) =>
          right.riskLevel - left.riskLevel || left.filePath.localeCompare(right.filePath)
      );

    return Promise.all(
      sortedFindings.map(async (finding) => {
        const messageHtml = await unstable_cache(
          async () =>
            markdownToHtml({
              content: finding.message,
              name,
              owner,
            }),
          [`finding-html-${owner ?? "unknown"}-${name ?? "unknown"}-${finding.id}`],
          {
            revalidate: false,
            tags: ["findings", owner ?? "unknown", name ?? "unknown", finding.id],
          }
        )();

        return {
          ...finding,
          messageHtml,
        };
      })
    );
  },

  coerceAnalysisPayload(
    analysis: LatestCompletedAnalysis | null | undefined
  ): AnalysisPayload | null {
    if (analysis == null || analysis.metricsJson == null || analysis.resultJson == null)
      return null;

    const parsed = aiSchema.safeParse(analysis.resultJson);
    if (!parsed.success) {
      appLogger.warn({
        error: z.treeifyError(parsed.error),
        id: analysis.publicId,
        msg: "Zod mismatch",
      });
      return {
        aiResult: analysis.resultJson as AIResult,
        analysis,
        metrics: analysis.metricsJson as unknown as RepoMetrics,
      };
    }

    return {
      aiResult: parsed.data,
      analysis,
      metrics: analysis.metricsJson as unknown as RepoMetrics,
    };
  },

  computeImpactScore(
    files: Array<Pick<PRChangedFileSnapshot, "additions" | "deletions">>,
    findingCount: number,
    markers: { api: boolean; entrypoint: boolean; risk: boolean }
  ) {
    const changeIntensity = sumBy(files, (file) =>
      Math.min(18, Math.ceil((file.additions + file.deletions) / 20))
    );
    const findingBoost = findingCount * 12;
    const markerBoost =
      (markers.entrypoint ? 12 : 0) + (markers.api ? 10 : 0) + (markers.risk ? 6 : 0);

    return Math.min(100, changeIntensity + findingBoost + markerBoost);
  },

  countFindingsByFile(findings: ParsedFinding[]) {
    const countByFile = new Map<string, number>();

    for (const finding of findings) {
      const nextCount = (countByFile.get(finding.file) ?? 0) + 1;
      countByFile.set(finding.file, nextCount);
    }

    return countByFile;
  },

  matchTopLevelZone<TNode extends { id: string; label: string; path: string }>(
    topLevelNodes: TNode[],
    filePath: string,
    previousFilePath: null | string
  ) {
    const matchPath = (path: string) =>
      topLevelNodes
        .filter((node) => isPathInsideScope(path, node.path))
        .toSorted((left, right) => right.path.length - left.path.length)[0] ?? null;

    return matchPath(filePath) ?? (previousFilePath == null ? null : matchPath(previousFilePath));
  },

  parseChangedFilesSnapshot(analysis: ImpactAnalysis): PRChangedFileSnapshot[] {
    const parsed = z.array(changedFileSnapshotSchema).safeParse(analysis.changedFilesJson);
    if (parsed.success) {
      return parsed.data.map((file) => ({
        additions: file.additions,
        deletions: file.deletions,
        filePath: normalize(file.filePath),
        previousFilePath: file.previousFilePath == null ? null : normalize(file.previousFilePath),
        status: file.status,
      }));
    }

    const legacyPaths = new Set<string>();
    for (const comment of analysis.comments) legacyPaths.add(normalize(comment.filePath));

    const findings = this.parsePersistedFindings(analysis);
    for (const finding of findings) legacyPaths.add(normalize(finding.file));

    return [...legacyPaths].map((filePath) => ({
      additions: 0,
      deletions: 0,
      filePath,
      previousFilePath: null,
      status: "modified" as const,
    }));
  },

  parsePersistedFindings(analysis: ImpactAnalysis): ParsedFinding[] {
    const parsed = z.array(persistedFindingSchema).safeParse(analysis.findingsJson);
    if (parsed.success) {
      return parsed.data.map((finding) => ({
        ...finding,
        file: normalize(finding.file),
      }));
    }

    return analysis.comments.map((comment) => ({
      file: normalize(comment.filePath),
      line: comment.line,
      message: comment.body,
      score: comment.riskLevel,
      title: comment.findingType,
      type: comment.findingType,
    }));
  },

  resolveMatchedNode(
    nodeId: string,
    analyzeContext: ReturnType<typeof createAnalyzeContextBuilder>,
    topLevelNodeById: Map<string, TopLevelImpactNode>,
    nodeDetailCache: Map<string, ReturnType<typeof analyzeContext.getStructureNode>>
  ) {
    if (nodeId.startsWith("group:")) {
      const node = topLevelNodeById.get(nodeId);
      return node == null ? null : { ...node, markers: null };
    }

    if (!nodeDetailCache.has(nodeId)) {
      nodeDetailCache.set(nodeId, analyzeContext.getStructureNode(nodeId));
    }

    const detail = nodeDetailCache.get(nodeId);
    if (detail == null) return null;

    return detail.node;
  },

  selectPrimaryFile(changedFiles: Array<PRImpactPayload["changedFiles"][number]>) {
    return (
      changedFiles.toSorted((left, right) => {
        const leftScore = left.findingCount * 20 + left.additions + left.deletions;
        const rightScore = right.findingCount * 20 + right.additions + right.deletions;
        return rightScore - leftScore || left.filePath.localeCompare(right.filePath);
      })[0] ?? null
    );
  },

  toAnalysisRef(
    analysis:
      | null
      | Pick<LatestCompletedAnalysis, "commitSha" | "createdAt" | "publicId">
      | undefined
  ): AnalysisRef | null {
    if (analysis == null) return null;

    return {
      analysisId: analysis.publicId,
      commitSha: analysis.commitSha,
      createdAt: analysis.createdAt,
    };
  },

  toAvailableDocs(repo: Pick<RepoWithLatestAnalysisAndDocs, "analyses" | "documents">) {
    const latestAnalysis = this.coerceAnalysisPayload(repo.analyses[0]);
    return dedupeLatestDocsByType(repo.documents).map((doc) =>
      toDocSummary(doc, latestAnalysis?.aiResult ?? null)
    );
  },

  toBriefPanelInput(params: { explain: ExplainPayload; structureNode: StructureNodePayload }) {
    return {
      explain: this.toExplainBase(params.explain),
      structureNode: this.toStructureNodeBase(params.structureNode),
    };
  },

  toDetailedMetrics(analysis: LatestCompletedAnalysis | null) {
    const payload = this.coerceAnalysisPayload(analysis);
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
        hotspotSignals: metrics.hotspotSignals ?? [],
        orphanModules: metrics.orphanModules,
        routeInventory: metrics.routeInventory ?? null,
      },
      domain: {
        analysis: aiResult.domain_analysis ?? null,
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
        duplicationReport: metrics.duplicationReport,
        health: metrics.healthScore,
        modularity: metrics.modularityIndex,
        security: metrics.securityScore,
        techDebt: metrics.techDebtScore,
      },
      recommendations: {
        bottlenecks: aiResult.mainBottlenecks ?? [],
        infrastructure: aiResult.sections.infrastructure_and_scaling,
        performanceAudit: aiResult.sections.performance_audit,
        refactoringTargets: aiResult.refactoring_targets,
        techDebtInventory: aiResult.sections.tech_debt_inventory,
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
        topRisks: findings,
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

  toExplainBase(explain: ExplainPayload) {
    return {
      confidence: explain.confidence,
      nextSuggestedPaths: explain.nextSuggestedPaths,
      relationships: explain.relationships,
      role: explain.role,
      sourcePaths: explain.sourcePaths,
      summary: explain.summary,
      whyImportant: explain.whyImportant,
    };
  },

  toInteractiveBriefNodePayloadInput(params: {
    explain: ExplainPayload;
    structureNode: StructureNodePayload;
  }) {
    return {
      explain: {
        analysisRef: params.explain.analysisRef ?? null,
        ...this.toExplainBase(params.explain),
      },
      structureNode: {
        analysisRef: params.structureNode.analysisRef ?? null,
        ...this.toStructureNodeBase(params.structureNode),
      },
    };
  },

  toOverview(repo: RepoWithLatestAnalysisAndDocs) {
    const payload = this.coerceAnalysisPayload(repo.analyses[0]);
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
      domain: aiResult.domain_analysis ?? null,
      languages: metrics.languages,
      maintenance: metrics.maintenanceStatus,
      mostComplexFiles: metrics.mostComplexFiles,
      repo: {
        defaultBranch: repo.defaultBranch,
        description: repo.description,
        forks: repo.forks,
        id: repo.publicId,
        language: repo.language,
        languageColor: getLanguageColor(repo.language),
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
        duplicationPercentage: metrics.duplicationReport.duplicationPercentage,
      },
      stats: {
        configFiles: metrics.configFiles,
        fileCount: metrics.fileCount,
        linesOfCode: metrics.totalLoc,
        totalSizeKb: metrics.totalSizeKb,
        totalSizeLabel: `${metrics.totalSizeKb} KB`,
      },
      summary: {
        ...aiResult.executive_summary,
        key_innovations: aiResult.executive_summary.key_innovations ?? [],
      },
      teamRoles: metrics.teamRoles,
      topRisks: aiResult.findings ?? [],
    };
  },

  toStructureNodeBase(structureNode: StructureNodePayload) {
    return {
      breadcrumbs: structureNode.breadcrumbs.map((item) => ({
        id: item.id,
        label: item.label,
        path: item.path,
      })),
      canDrillDeeper: structureNode.canDrillDeeper,
      children: structureNode.children,
      edges: structureNode.edges,
      inspect: structureNode.inspect,
      node: structureNode.node,
    };
  },
};
