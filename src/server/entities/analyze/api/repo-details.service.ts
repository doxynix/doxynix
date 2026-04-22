import { unstable_cache } from "next/cache";
import type { DocType } from "@prisma/client";
import { TRPCError } from "@trpc/server";

import { highlightCode } from "@/shared/lib/shiki";

import type { DbClient } from "@/server/shared/infrastructure/db";
import {
  getLatestCompletedAnalysis,
  getRepoWithLatestAnalysisAndDocs,
} from "@/server/shared/infrastructure/repo-snapshots";
import { markdownToHtml } from "@/server/shared/lib/markdown-to-html";

import { createAnalyzeContextBuilder } from "../lib/analyze-context-builder";
import {
  buildInteractiveBriefNodePayload,
  buildInteractiveBriefPanel,
  buildInteractiveBriefPayload,
} from "../lib/brief";
import { repoDetailsPresenter } from "./repo-details.presenter";

type ExplainPayload = NonNullable<
  ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getNodeExplain"]>
>;
type StructureNodePayload = NonNullable<
  ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getStructureNode"]>
>;

function toBriefPanelInput(params: {
  explain: NonNullable<
    ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getNodeExplain"]>
  >;
  structureNode: NonNullable<
    ReturnType<ReturnType<typeof createAnalyzeContextBuilder>["getStructureNode"]>
  >;
}) {
  return {
    explain: mapExplainBase(params.explain),
    structureNode: mapStructureNodeBase(params.structureNode),
  };
}

function toInteractiveBriefNodePayloadInput(params: {
  explain: ExplainPayload;
  structureNode: StructureNodePayload;
}) {
  return {
    explain: {
      analysisRef: params.explain.analysisRef ?? null,
      ...mapExplainBase(params.explain),
    },
    structureNode: {
      analysisRef: params.structureNode.analysisRef ?? null,
      ...mapStructureNodeBase(params.structureNode),
    },
  };
}

export const repoDetailsService = {
  async getAvailableDocs(db: DbClient, repoId: string) {
    const repo = await loadRepoOrThrow(db, repoId);
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

    return { html, id: doc.publicId, raw: doc.content };
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

  async getInteractiveBrief(db: DbClient, repoId: string) {
    const repo = await loadRepoOrThrow(db, repoId);
    const analyzeContext = createAnalyzeContextBuilder(repo);
    const overview = repoDetailsPresenter.toOverview(repo);
    const structure = analyzeContext.getStructureMap();

    if (structure == null || overview == null) return null;

    const defaultNodeId = structure.selection.defaultNodeId;
    const panel =
      defaultNodeId == null
        ? null
        : (() => {
            const structureNode = analyzeContext.getStructureNode(defaultNodeId);
            const explain = analyzeContext.getNodeExplain(defaultNodeId);
            if (structureNode == null || explain == null) return null;

            return buildInteractiveBriefPanel(toBriefPanelInput({ explain, structureNode }));
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
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId);
    const structureNode = analyzeContext.getStructureNode(nodeId);
    const explain = analyzeContext.getNodeExplain(nodeId);

    if (structureNode == null || explain == null) return null;

    return buildInteractiveBriefNodePayload(
      toInteractiveBriefNodePayloadInput({ explain, structureNode })
    );
  },

  async getNodeExplain(db: DbClient, repoId: string, nodeId: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId);
    return analyzeContext.getNodeExplain(nodeId);
  },

  async getOverview(db: DbClient, repoId: string) {
    const repo = await loadRepoOrThrow(db, repoId);
    return repoDetailsPresenter.toOverview(repo);
  },

  async getStructureMap(db: DbClient, repoId: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId);
    return analyzeContext.getStructureMap();
  },

  async getStructureNode(db: DbClient, repoId: string, nodeId: string) {
    const analyzeContext = await loadAnalyzeContextBuilderOrThrow(db, repoId);
    return analyzeContext.getStructureNode(nodeId);
  },

  async highlightFile(content: string, path: string) {
    const ext = path.split(".").pop() ?? "txt";
    const html = await highlightCode(content, ext);
    return { html };
  },
};

async function loadRepoOrThrow(db: DbClient, repoId: string) {
  const repo = await getRepoWithLatestAnalysisAndDocs(db, repoId);
  if (repo == null) throw new TRPCError({ code: "NOT_FOUND" });
  return repo;
}

async function loadAnalyzeContextBuilderOrThrow(db: DbClient, repoId: string) {
  return createAnalyzeContextBuilder(await loadRepoOrThrow(db, repoId));
}

function mapExplainBase(explain: ExplainPayload) {
  return {
    confidence: explain.confidence,
    nextSuggestedPaths: explain.nextSuggestedPaths,
    relationships: explain.relationships,
    role: explain.role,
    sourcePaths: explain.sourcePaths,
    summary: explain.summary,
    whyImportant: explain.whyImportant,
  };
}

function mapStructureNodeBase(structureNode: StructureNodePayload) {
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
}
