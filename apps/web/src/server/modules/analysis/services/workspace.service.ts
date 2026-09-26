import { uniq } from "es-toolkit";
import { normalize } from "pathe";

import type { DbClient } from "@/server/core/db";
import type { RepoNodeContextPayload, RepoWorkspacePayload } from "@/server/utils/types";

import { analysisMapper } from "../analysis.mapper";
import { analysisRepo } from "../analysis.repository";
import { createAnalyzeContextBuilder } from "../logic/analyze-context-builder";
import { buildInteractiveBriefNodePayload } from "../logic/brief";
import { matchDocSections } from "../logic/doc-section-matcher";
import { buildWorkspacePayload } from "../logic/workspace-payload";

export const workspaceService = {
  async getDetailedMetrics(db: DbClient, repoId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) {
      return null;
    }
    return analysisMapper.toDetailedMetrics(repo.analyses[0] ?? null);
  },

  async getNodeContext(
    db: DbClient,
    repoId: string,
    nodeId: string,
    aid?: string,
  ): Promise<null | RepoNodeContextPayload> {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) {
      return null;
    }
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const structureNode = analyzeContext.getStructureNode(nodeId);
    const explain = analyzeContext.getNodeExplain(nodeId);

    if (structureNode == null || explain == null) {
      return null;
    }

    const relatedFiles = uniq(
      [
        structureNode.node.path,
        ...structureNode.node.previewPaths,
        ...structureNode.inspect.samplePaths,
        ...explain.sourcePaths,
      ].map((path) => normalize(path)),
    );

    const [docs, findings] = await Promise.all([
      this.loadRelatedDocSections(
        db,
        repoId,
        nodeId,
        structureNode.node.label,
        relatedFiles,
        analyzeContext,
      ),
      analysisRepo.loadRelatedPrFindings(db, repoId, relatedFiles),
    ]);

    const fixes = await analysisRepo.loadRelatedFixes(
      db,
      findings.map((finding) => finding.prAnalysisId),
    );

    return {
      ...buildInteractiveBriefNodePayload(
        analysisMapper.toInteractiveBriefNodePayloadInput({ explain, structureNode }),
      ),
      related: {
        docs,
        files: relatedFiles,
        findings,
        fixes,
      },
    };
  },

  async getStructureMap(db: DbClient, repoId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) {
      return null;
    }
    const analyzeContext = createAnalyzeContextBuilder(repo);
    return analyzeContext.getStructureMap();
  },

  async getStructureNode(db: DbClient, repoId: string, nodeId: string, aid?: string) {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) {
      return null;
    }
    const analyzeContext = createAnalyzeContextBuilder(repo);
    return analyzeContext.getStructureNode(nodeId);
  },

  async getWorkspace(
    db: DbClient,
    repoId: string,
    aid?: string,
  ): Promise<null | RepoWorkspacePayload> {
    const repo = await analysisRepo.getRepoSnapshot(db, repoId, aid);
    if (repo == null) {
      return null;
    }
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const overview = analysisMapper.toOverview(repo);
    const structure = analyzeContext.getStructureMap();

    if (overview == null || structure == null) {
      return null;
    }

    return buildWorkspacePayload({ overview, structure });
  },

  async loadRelatedDocSections(
    db: DbClient,
    repoId: string,
    nodeId: string,
    nodeLabel: string,
    relatedFiles: string[],
    analyzeContext: ReturnType<typeof createAnalyzeContextBuilder>,
  ) {
    const docs = await analysisRepo.loadLatestDocumentsWithContent(db, repoId);

    return matchDocSections({
      docs,
      graph: analyzeContext.getStructureMap()?.graph ?? null,
      nodeId,
      nodeLabel,
      relatedFiles,
    });
  },
};
