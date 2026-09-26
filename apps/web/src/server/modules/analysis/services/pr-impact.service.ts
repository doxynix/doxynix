import type { DbClient } from "@/server/core/db";
import type { PRImpactPayload } from "@/server/utils/types";

import { analysisMapper } from "../analysis.mapper";
import { analysisRepo } from "../analysis.repository";
import { createAnalyzeContextBuilder } from "../logic/analyze-context-builder";
import { buildTopLevelNodes } from "../logic/graph-navigator";
import { mapChangedFilesToImpactNodes } from "../logic/impact-file-mapper";

export const prImpactService = {
  async getAnalysis(db: DbClient, analysisId: string) {
    const analysis = await db.pullRequestAnalysis.findUnique({
      select: {
        baseSha: true,
        createdAt: true,
        error: true,
        headSha: true,
        prNumber: true,
        publicId: true,
        riskScore: true,
        status: true,
      },
      where: { publicId: analysisId },
    });

    if (analysis == null) {
      throw new Error("Analysis not found");
    }

    return analysis;
  },

  async getByRepoAndPRNumber(db: DbClient, repoId: string, prNumber: number) {
    const analysis = await analysisRepo.loadImpactAnalysis(db, repoId, prNumber);
    if (analysis == null) {
      return null;
    }

    const changedFiles = analysisMapper.parseChangedFilesSnapshot(analysis);
    const findings = analysisMapper.parsePersistedFindings(analysis);

    const repo = await analysisRepo.getRepoBySha(db, repoId, analysis.headSha);
    const repoSnapshot = repo ?? (await analysisRepo.getRepoSnapshot(db, repoId));

    if (repoSnapshot == null) {
      return null;
    }

    const analyzeContext = createAnalyzeContextBuilder(repoSnapshot);
    const structureContext = analyzeContext.getStructureContext();
    const topLevelNodes = structureContext == null ? [] : buildTopLevelNodes(structureContext);
    const interestingPaths = new Set(structureContext?.allInterestingPaths ?? []);
    const nodeById = new Map(topLevelNodes.map((node) => [node.id, node] as const));
    const nodeDetailCache = new Map<string, ReturnType<typeof analyzeContext.getStructureNode>>();
    const findingsByFile = analysisMapper.countFindingsByFile(findings);

    const changedFileItems = mapChangedFilesToImpactNodes({
      analyzeContext,
      changedFiles,
      findingsByFile,
      interestingPaths,
      nodeById,
      nodeDetailCache,
    });

    const affectedZones = analysisMapper.buildAffectedZones(changedFileItems, findings, nodeById);
    const affectedNodes = analysisMapper.buildAffectedNodes(
      changedFileItems,
      findings,
      analyzeContext,
      nodeById,
      nodeDetailCache,
    );
    const topFindings = await analysisMapper.buildTopFindings(
      findings,
      changedFileItems,
      nodeById,
      repoSnapshot.owner,
      repoSnapshot.name,
    );
    const primaryFile = analysisMapper.selectPrimaryFile(changedFileItems);
    const primaryNodeId =
      primaryFile?.nodeId ?? affectedNodes[0]?.nodeId ?? affectedZones[0]?.nodeId ?? null;

    return {
      affectedNodes,
      affectedZones,
      analysis: {
        baseSha: analysis.baseSha,
        createdAt: analysis.createdAt,
        headSha: analysis.headSha,
        id: analysis.publicId,
        prNumber: analysis.prNumber,
        riskScore: analysis.riskScore,
        status: analysis.status,
      },
      changedFiles: changedFileItems,
      fixes: analysis.generatedFixes.map((fix) => ({
        githubPrNumber: fix.githubPrNumber,
        githubPrUrl: fix.githubPrUrl,
        id: fix.publicId,
        status: fix.status,
        title: fix.title,
      })),
      navigationHints: {
        primaryFilePath: primaryFile?.filePath ?? null,
        primaryNodeId,
        recommendedView:
          primaryNodeId?.startsWith("group:") === true
            ? "map"
            : primaryFile?.nodeId != null
              ? "code"
              : "map",
      },
      summary: {
        affectedFiles: changedFileItems.length,
        affectedNodes: affectedNodes.length,
        affectedZones: affectedZones.length,
        findings: findings.length,
        linkedFixes: analysis.generatedFixes.length,
      },
      topFindings,
    } satisfies PRImpactPayload;
  },

  async listByRepository(db: DbClient, repoId: string) {
    const items = await db.pullRequestAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        _count: {
          select: { comments: true },
        },
        createdAt: true,
        headSha: true,
        prNumber: true,
        publicId: true,
        riskScore: true,
        status: true,
      },
      where: {
        repo: {
          publicId: repoId,
        },
      },
    });

    return items.map((item) => ({
      createdAt: item.createdAt,
      findingCount: item._count.comments,
      headSha: item.headSha,
      id: item.publicId,
      prNumber: item.prNumber,
      riskScore: item.riskScore,
      status: item.status,
    }));
  },
};
