import { unstable_cache } from "next/cache";
import type { DocType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { highlightCode } from "@/shared/lib/shiki";

import { repoDetailsPresenter } from "@/server/entities/analyze/api/repo-details.presenter";
import {
  buildInteractiveBriefNodePayload,
  buildInteractiveBriefPanel,
  buildInteractiveBriefPayload,
} from "@/server/entities/analyze/lib/brief";
import type { DbClient } from "@/server/shared/infrastructure/db";
import {
  getLatestCompletedAnalysis,
  getRepoWithLatestAnalysisAndDocs,
} from "@/server/shared/infrastructure/repo-snapshots";
import { markdownToHtml } from "@/server/shared/lib/markdown-to-html";

export const repoDetailsService = {
  async getAvailableDocs(db: DbClient, repoId: string) {
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);
    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });

    return repoDetailsPresenter.toAvailableDocs(repo);
  },

  async getDetailedMetrics(db: DbClient, repoId: string) {
    const analysis = await getLatestCompletedAnalysis(db, repoId);
    return repoDetailsPresenter.toDetailedMetrics(analysis);
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
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
    return repoDetailsPresenter.toOverview(repo);
  },

  async getStructureMap(db: DbClient, repoId: string) {
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
    return repoDetailsPresenter.toStructureMap(repo);
  },

  async getStructureNode(db: DbClient, repoId: string, nodeId: string) {
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
    return repoDetailsPresenter.toStructureNode(repo, nodeId);
  },

  async getNodeExplain(db: DbClient, repoId: string, nodeId: string) {
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
    return repoDetailsPresenter.toNodeExplain(repo, nodeId);
  },

  async getInteractiveBrief(db: DbClient, repoId: string) {
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });

    const overview = repoDetailsPresenter.toOverview(repo);
    const structure = repoDetailsPresenter.toStructureMap(repo);

    if (structure == null || overview == null) return null;

    const defaultNodeId = structure.selection.defaultNodeId;
    const panel =
      defaultNodeId == null
        ? null
        : (() => {
            const structureNode = repoDetailsPresenter.toStructureNode(repo, defaultNodeId);
            const explain = repoDetailsPresenter.toNodeExplain(repo, defaultNodeId);
            if (structureNode == null || explain == null) return null;

            return buildInteractiveBriefPanel({
              explain,
              structureNode,
            });
          })();

    return buildInteractiveBriefPayload({
      analysisRef: structure.analysisRef,
      capabilities: {
        canDocumentFile: true,
        canDrillDown: true,
        canExplainNodes: true,
        canHighlightFiles: true,
        canQuickAudit: true,
      },
      defaultNodeId,
      docsSummary: {
        availableCount: overview.docs.availableCount,
        availableTypes: overview.docs.availableTypes,
        hasSwagger: overview.docs.hasSwagger,
      },
      overview: {
        architectureStyle: structure.overview.architectureStyle,
        primaryEntrypoints: structure.overview.primaryEntrypoints,
        primaryModules: structure.overview.primaryModules,
        purpose: structure.overview.purpose,
        repositoryKind: structure.overview.repositoryKind,
        stack: structure.overview.stack,
      },
      panel,
      structure: {
        edges: structure.graph.edges,
        groups: structure.graph.groups,
        nodes: structure.graph.nodes,
      },
    });
  },

  async getInteractiveBriefNode(db: DbClient, repoId: string, nodeId: string) {
    const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);

    if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });

    const structureNode = repoDetailsPresenter.toStructureNode(repo, nodeId);
    const explain = repoDetailsPresenter.toNodeExplain(repo, nodeId);

    if (structureNode == null || explain == null) return null;

    return buildInteractiveBriefNodePayload({
      explain,
      structureNode,
    });
  },

  async highlightFile(content: string, path: string) {
    const ext = path.split(".").pop() ?? "txt";
    const html = await highlightCode(content, ext);
    return { html };
  },
};
